/**
 * Workflow Snapshots Schema
 * Content-addressable snapshot storage for workflow isolation.
 * When a workflow starts, it captures an immutable snapshot of all input entities.
 * The workflow reads from this snapshot, completely isolated from subsequent user edits.
 *
 * @see src/lib/services/dag/workflow-snapshot.ts
 */

import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

/**
 * Workflow snapshots table
 * Content-addressable storage (Git-inspired): identical snapshots share storage.
 */
export const workflowSnapshots = sqliteTable(
  'workflow_snapshots',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    /** SHA-256 of snapshot data — enables deduplication */
    contentHash: text('content_hash').unique().notNull(),
    /** JSON snapshot of all input entity versions at workflow start time */
    snapshotData: text('snapshot_data', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index('idx_snapshot_content_hash').on(table.contentHash)]
);

export type WorkflowSnapshot = InferSelectModel<typeof workflowSnapshots>;
export type NewWorkflowSnapshot = InferInsertModel<typeof workflowSnapshots>;

const WORKFLOW_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

/**
 * Workflows table
 * Tracks workflow execution with reference to their frozen input snapshot.
 */
export const workflows = sqliteTable(
  'dag_workflows',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    type: text().notNull(),
    status: text().$type<WorkflowStatus>().default('pending').notNull(),
    snapshotId: text('snapshot_id').references(() => workflowSnapshots.id),
    /** JSON: entity IDs to version numbers used as inputs {"scene_123": 5} */
    inputEntityRefs: text('input_entity_refs', { mode: 'json' }).$type<
      Record<string, number>
    >(),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    /** JSON result data from workflow completion */
    result: text({ mode: 'json' }),
    error: text(),
  },
  (table) => [
    index('idx_dag_workflows_status').on(table.status),
    index('idx_dag_workflows_type').on(table.type),
    index('idx_dag_workflows_snapshot').on(table.snapshotId),
  ]
);

export type DagWorkflow = InferSelectModel<typeof workflows>;
export type NewDagWorkflow = InferInsertModel<typeof workflows>;
