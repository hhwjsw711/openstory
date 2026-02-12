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
export type VersionedEntity<T> = Omit<EntityVersion, 'data'> & {
  data: Readonly<T>;
};

/**
 * Create version 1 of a new entity.
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
      data,
      entityType,
      lifecycleState: 'valid',
      createdBy: createdBy ?? null,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create entity version for ${entityId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
  return row as VersionedEntity<T>;
}

/**
 * Create a new version of an existing entity.
 * Computes a new content hash and increments the version number.
 * Skips if content hasn't changed (returns current version).
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
    return current as VersionedEntity<T>;
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
      data,
      entityType: current.entityType,
      lifecycleState: 'valid',
      createdBy: createdBy ?? null,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create version ${newVersion} for ${entityId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
  return row as VersionedEntity<T>;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
    return (row as VersionedEntity<T>) ?? null;
  }

  const row = await getLatestVersion(entityId, branch);
  if (!row || row.lifecycleState === 'deleted') return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
  return row as VersionedEntity<T>;
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Drizzle JSON column returns unknown; caller guarantees T
  return rows as VersionedEntity<T>[];
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
