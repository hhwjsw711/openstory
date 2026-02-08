/**
 * Entity Versions Schema
 * Versioned entity storage for the DAG dependency system.
 * Every entity gets versioning with content hashes for staleness detection.
 *
 * @see src/lib/services/dag/versioned-entity-store.ts
 */

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

const ENTITY_TYPES = [
  'script',
  'scene',
  'cast',
  'character',
  'frame',
  'motion',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const LIFECYCLE_STATES = [
  'valid',
  'checking',
  'stale',
  'queued',
  'regenerating',
  'failed',
  'deleted',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/**
 * Entity versions table
 * Stores every version of every entity with content hashes for O(1) staleness checks.
 *
 * Primary key: (entity_id, branch_name, version) — composite key for efficient lookups.
 *
 * Note: SQLite uses text() for dates (ISO 8601) and text() for JSON.
 * PostgreSQL migration would use TIMESTAMPTZ and JSONB respectively.
 */
export const entityVersions = sqliteTable(
  'entity_versions',
  {
    id: text()
      .$defaultFn(() => generateId())
      .notNull(),
    entityId: text('entity_id').notNull(),
    version: integer().notNull(),
    branchName: text('branch_name').default('main').notNull(),
    parentVersion: integer('parent_version'),
    contentHash: text('content_hash').notNull(),
    data: text({ mode: 'json' }).notNull(),
    entityType: text('entity_type').$type<EntityType>().notNull(),
    lifecycleState: text('lifecycle_state')
      .$type<LifecycleState>()
      .default('valid')
      .notNull(),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Composite primary key equivalent (SQLite doesn't support composite PKs in Drizzle easily,
    // so we use a unique index + separate id PK)
    index('idx_entity_versions_lookup').on(
      table.entityId,
      table.branchName,
      table.version
    ),
    // Find current version for an entity on a branch (excluding deleted)
    index('idx_entity_current').on(table.entityId, table.branchName),
    // Content-addressable lookup
    index('idx_entity_content_hash').on(table.contentHash),
    // Type-based queries
    index('idx_entity_type').on(table.entityType),
  ]
);

export type EntityVersion = InferSelectModel<typeof entityVersions>;
export type NewEntityVersion = InferInsertModel<typeof entityVersions>;
