/**
 * Generation Queue Schema
 * Job queue for processing generation requests in dependency order.
 * Uses optimistic concurrency for job claiming (SQLite doesn't support SKIP LOCKED).
 *
 * @see src/lib/services/dag/generation-queue.ts
 */

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

const QUEUE_STATUSES = [
  'pending',
  'claimed',
  'completed',
  'failed',
  'skipped',
] as const;
export type QueueJobStatus = (typeof QUEUE_STATUSES)[number];

/**
 * Generation queue table
 * Jobs are enqueued in topological order and claimed by workers.
 *
 * Note: PostgreSQL migration would use `FOR UPDATE SKIP LOCKED` for claiming.
 * SQLite uses optimistic concurrency via version/status checks instead.
 */
export const generationQueue = sqliteTable(
  'generation_queue',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    entityId: text('entity_id').notNull(),
    priority: integer().default(0).notNull(),
    /** Hash of all input dependencies at enqueue time — skip if changed */
    inputHash: text('input_hash').notNull(),
    status: text().$type<QueueJobStatus>().default('pending').notNull(),
    claimedBy: text('claimed_by'),
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Find pending jobs in priority order
    index('idx_queue_pending').on(table.priority, table.createdAt),
    // Find jobs for a specific entity
    index('idx_queue_entity').on(table.entityId),
    // Status-based queries
    index('idx_queue_status').on(table.status),
  ]
);

export type GenerationQueueJob = InferSelectModel<typeof generationQueue>;
export type NewGenerationQueueJob = InferInsertModel<typeof generationQueue>;
