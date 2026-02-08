/**
 * Versioned Entity Store
 * Core versioned CRUD operations for all DAG entities.
 * Every entity gets versioning with content hashes for O(1) staleness detection.
 *
 * @module lib/services/dag/versioned-entity-store
 */

import { getDb } from '#db-client';
import { entityVersions } from '@/lib/db/schema/entity-versions';
import type {
  EntityType,
  EntityVersion,
  LifecycleState,
} from '@/lib/db/schema/entity-versions';
import { and, desc, eq, ne } from 'drizzle-orm';
import { computeContentHash } from './content-hash';

/**
 * Versioned entity as returned to consumers.
 * Generic over the entity data type for type safety.
 */
export type VersionedEntity<T> = {
  id: string;
  entityId: string;
  version: number;
  contentHash: string;
  parentVersion: number | null;
  branchName: string;
  data: Readonly<T>;
  entityType: EntityType;
  lifecycleState: LifecycleState;
  createdBy: string | null;
  createdAt: Date;
};

/** Helper: convert EntityVersion row to typed VersionedEntity. */
function toVersionedEntity<T>(row: EntityVersion): VersionedEntity<T> {
  // row.data is stored as JSON text — Drizzle returns it as unknown.
  // The caller is responsible for ensuring T matches the actual data shape.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
  const data: T = row.data as never;
  return {
    id: row.id,
    entityId: row.entityId,
    version: row.version,
    contentHash: row.contentHash,
    parentVersion: row.parentVersion,
    branchName: row.branchName,
    data,
    entityType: row.entityType,
    lifecycleState: row.lifecycleState,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

/** Helper: serialize entity data for the JSON text column. */
function toJsonColumn(data: unknown): Record<string, unknown> {
  // Drizzle's text({ mode: 'json' }) expects Record<string, unknown>
  // but our generic T could be any shape. The JSON round-trip is safe.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON round-trip produces correct shape
  return JSON.parse(JSON.stringify(data)) as never;
}

/**
 * Create version 1 of a new entity.
 *
 * @param entityId - Unique entity identifier
 * @param entityType - Type of entity (script, scene, frame, etc.)
 * @param data - Entity data
 * @param createdBy - User ID who created this version
 * @returns The created versioned entity
 */
export async function createEntity<T>(
  entityId: string,
  entityType: EntityType,
  data: T,
  createdBy?: string
): Promise<VersionedEntity<T>> {
  const contentHash = await computeContentHash(data);

  const [row] = await getDb()
    .insert(entityVersions)
    .values({
      entityId,
      version: 1,
      branchName: 'main',
      parentVersion: null,
      contentHash,
      data: toJsonColumn(data),
      entityType,
      lifecycleState: 'valid',
      createdBy: createdBy ?? null,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create entity version for ${entityId}`);
  }

  return toVersionedEntity<T>(row);
}

/**
 * Create a new version of an existing entity.
 * Computes a new content hash and increments the version number.
 *
 * @param entityId - Existing entity identifier
 * @param data - New entity data
 * @param createdBy - User ID who created this version
 * @param branch - Branch name (default: 'main')
 * @returns The new versioned entity
 */
export async function updateEntity<T>(
  entityId: string,
  data: T,
  createdBy?: string,
  branch = 'main'
): Promise<VersionedEntity<T>> {
  const current = await getLatestVersion(entityId, branch);
  if (!current) {
    throw new Error(`Entity ${entityId} not found on branch ${branch}`);
  }

  const contentHash = await computeContentHash(data);

  // Skip if content hasn't actually changed
  if (contentHash === current.contentHash) {
    return toVersionedEntity<T>(current);
  }

  const newVersion = current.version + 1;

  const [row] = await getDb()
    .insert(entityVersions)
    .values({
      entityId,
      version: newVersion,
      branchName: branch,
      parentVersion: current.version,
      contentHash,
      data: toJsonColumn(data),
      entityType: current.entityType,
      lifecycleState: 'valid',
      createdBy: createdBy ?? null,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create version ${newVersion} for ${entityId}`);
  }

  return toVersionedEntity<T>(row);
}

/**
 * Get a specific version of an entity, or the latest if no version specified.
 */
export async function getEntity<T>(
  entityId: string,
  version?: number,
  branch = 'main'
): Promise<VersionedEntity<T> | null> {
  if (version !== undefined) {
    const row = await getDb().query.entityVersions.findFirst({
      where: and(
        eq(entityVersions.entityId, entityId),
        eq(entityVersions.branchName, branch),
        eq(entityVersions.version, version),
        ne(entityVersions.lifecycleState, 'deleted')
      ),
    });
    return row ? toVersionedEntity<T>(row) : null;
  }

  const row = await getLatestVersion(entityId, branch);
  if (!row || row.lifecycleState === 'deleted') return null;
  return toVersionedEntity<T>(row);
}

/**
 * Get version history for an entity on a branch.
 */
export async function getHistory<T>(
  entityId: string,
  branch = 'main'
): Promise<VersionedEntity<T>[]> {
  const rows = await getDb()
    .select()
    .from(entityVersions)
    .where(
      and(
        eq(entityVersions.entityId, entityId),
        eq(entityVersions.branchName, branch),
        ne(entityVersions.lifecycleState, 'deleted')
      )
    )
    .orderBy(desc(entityVersions.version));

  return rows.map((row) => toVersionedEntity<T>(row));
}

/**
 * Create a branch from a specific version.
 */
export async function branchEntity<T>(
  entityId: string,
  fromVersion: number,
  branchName: string
): Promise<VersionedEntity<T>> {
  const source = await getEntity<T>(entityId, fromVersion, 'main');
  if (!source) {
    throw new Error(`Entity ${entityId} version ${fromVersion} not found`);
  }

  const [row] = await getDb()
    .insert(entityVersions)
    .values({
      entityId,
      version: 1,
      branchName,
      parentVersion: fromVersion,
      contentHash: source.contentHash,
      data: toJsonColumn(source.data),
      entityType: source.entityType,
      lifecycleState: 'valid',
      createdBy: source.createdBy,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to branch entity ${entityId} to ${branchName}`);
  }

  return toVersionedEntity<T>(row);
}

/**
 * Restore an entity to a previous version's data.
 * Creates a new version (doesn't rewrite history) with the old version's data.
 */
export async function restoreEntity<T>(
  entityId: string,
  toVersion: number,
  branch = 'main'
): Promise<VersionedEntity<T>> {
  const [source, current] = await Promise.all([
    getEntity<T>(entityId, toVersion, branch),
    getLatestVersion(entityId, branch),
  ]);

  if (!source) {
    throw new Error(
      `Entity ${entityId} version ${toVersion} not found on branch ${branch}`
    );
  }
  if (!current) {
    throw new Error(`Entity ${entityId} has no versions on branch ${branch}`);
  }

  const newVersion = current.version + 1;

  const [row] = await getDb()
    .insert(entityVersions)
    .values({
      entityId,
      version: newVersion,
      branchName: branch,
      parentVersion: toVersion,
      contentHash: source.contentHash,
      data: toJsonColumn(source.data),
      entityType: source.entityType,
      lifecycleState: 'valid',
      createdBy: source.createdBy,
    })
    .returning();

  if (!row) {
    throw new Error(
      `Failed to restore entity ${entityId} to version ${toVersion}`
    );
  }

  return toVersionedEntity<T>(row);
}

/**
 * Update the lifecycle state of the latest version of an entity.
 */
export async function updateLifecycleState(
  entityId: string,
  state: LifecycleState,
  branch = 'main'
): Promise<void> {
  const current = await getLatestVersion(entityId, branch);
  if (!current) {
    throw new Error(`Entity ${entityId} not found on branch ${branch}`);
  }

  await getDb()
    .update(entityVersions)
    .set({ lifecycleState: state })
    .where(
      and(
        eq(entityVersions.entityId, current.entityId),
        eq(entityVersions.branchName, branch),
        eq(entityVersions.version, current.version)
      )
    );
}

/**
 * Get the content hash of the latest version of an entity.
 */
export async function getContentHash(
  entityId: string,
  branch = 'main'
): Promise<string | null> {
  const row = await getLatestVersion(entityId, branch);
  return row?.contentHash ?? null;
}

// Internal helper: get latest version row
async function getLatestVersion(
  entityId: string,
  branch: string
): Promise<EntityVersion | null> {
  const rows = await getDb()
    .select()
    .from(entityVersions)
    .where(
      and(
        eq(entityVersions.entityId, entityId),
        eq(entityVersions.branchName, branch)
      )
    )
    .orderBy(desc(entityVersions.version))
    .limit(1);

  return rows[0] ?? null;
}
