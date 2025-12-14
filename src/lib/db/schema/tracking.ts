/**
 * API Request Tracking Schema
 * Tracks Fal.ai and LetzAI API usage for cost calculation and monitoring
 */

import {
  desc,
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  real,
  index,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';
import { teams } from './teams';

// Enum values as constants (SQLite doesn't have native enums)
const FAL_REQUEST_STATUSES = ['pending', 'completed', 'failed'] as const;
export type FalRequestStatus = (typeof FAL_REQUEST_STATUSES)[number];

const LETZAI_REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
] as const;
export type LetzaiRequestStatus = (typeof LETZAI_REQUEST_STATUSES)[number];

/**
 * Fal.ai requests tracking
 * Tracks all requests to Fal.ai for usage monitoring and cost calculation
 */
export const falRequests = sqliteTable(
  'fal_requests',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    jobId: text('job_id'),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    model: text({ length: 255 }).notNull(),
    requestPayload: text('request_payload', { mode: 'json' })
      .$defaultFn(() => ({}))
      .notNull(),
    responseData: text('response_data', { mode: 'json' }),
    // Use real (float) for cost since SQLite doesn't have decimal/numeric
    costCredits: real('cost_credits').default(0),
    latencyMs: integer('latency_ms'),
    status: text().$type<FalRequestStatus>().default('pending').notNull(),
    error: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_fal_requests_created_at').on(desc(table.createdAt)),
    index('idx_fal_requests_job_id').on(table.jobId),
    index('idx_fal_requests_model').on(table.model),
    index('idx_fal_requests_status').on(table.status),
    index('idx_fal_requests_team_id').on(table.teamId),
    index('idx_fal_requests_user_id').on(table.userId),
  ]
);

/**
 * LetzAI requests tracking
 * Tracks all requests to LetzAI for usage monitoring and cost calculation
 */
export const letzaiRequests = sqliteTable(
  'letzai_requests',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    jobId: text('job_id'),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    endpoint: text().notNull(),
    model: text(),
    requestPayload: text('request_payload', { mode: 'json' }).notNull(),
    status: text().$type<LetzaiRequestStatus>().default('pending').notNull(),
    responseData: text('response_data', { mode: 'json' }),
    error: text(),
    costCredits: real('cost_credits'),
    latencyMs: integer('latency_ms'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: integer('completed_at', {
      mode: 'timestamp',
    }),
  },
  (table) => [
    index('idx_letzai_requests_created_at').on(table.createdAt),
    index('idx_letzai_requests_endpoint').on(table.endpoint),
    index('idx_letzai_requests_job_id').on(table.jobId),
    index('idx_letzai_requests_status').on(table.status),
    index('idx_letzai_requests_team_id').on(table.teamId),
    // Compound index for team + status + created queries
    index('idx_letzai_requests_team_status_created').on(
      table.teamId,
      table.status,
      table.createdAt
    ),
    index('idx_letzai_requests_user_id').on(table.userId),
  ]
);

// Relations
export const falRequestsRelations = relations(falRequests, ({ one }) => ({
  team: one(teams, {
    fields: [falRequests.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [falRequests.userId],
    references: [user.id],
  }),
}));

export const letzaiRequestsRelations = relations(letzaiRequests, ({ one }) => ({
  team: one(teams, {
    fields: [letzaiRequests.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [letzaiRequests.userId],
    references: [user.id],
  }),
}));

// Type exports
export type FalRequest = InferSelectModel<typeof falRequests>;
export type NewFalRequest = InferInsertModel<typeof falRequests>;

export type LetzaiRequest = InferSelectModel<typeof letzaiRequests>;
export type NewLetzaiRequest = InferInsertModel<typeof letzaiRequests>;
