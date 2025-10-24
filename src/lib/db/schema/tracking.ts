/**
 * API Request Tracking Schema
 * Tracks Fal.ai and LetzAI API usage for cost calculation and monitoring
 */

import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { teams } from './teams';

// Enums
export const falRequestStatusEnum = ['pending', 'completed', 'failed'] as const;
export type FalRequestStatus = (typeof falRequestStatusEnum)[number];

export const letzaiRequestStatusEnum = [
  'pending',
  'in_progress',
  'completed',
  'failed',
] as const;
export type LetzaiRequestStatus = (typeof letzaiRequestStatusEnum)[number];

/**
 * Fal.ai requests tracking
 * Tracks all requests to Fal.ai for usage monitoring and cost calculation
 */
export const falRequests = pgTable(
  'fal_requests',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: uuid('job_id'), // Removed FK constraint as jobs table no longer exists
    teamId: uuid('team_id').references(() => teams.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    model: varchar('model', { length: 255 }).notNull(),
    requestPayload: jsonb('request_payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    responseData: jsonb('response_data').$type<Record<string, unknown>>(),
    costCredits: decimal('cost_credits', { precision: 10, scale: 4 }).default(
      '0'
    ),
    latencyMs: integer('latency_ms'),
    status: text('status', { enum: falRequestStatusEnum })
      .notNull()
      .default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('idx_fal_requests_job_id').on(table.jobId),
    teamIdIdx: index('idx_fal_requests_team_id').on(table.teamId),
    userIdIdx: index('idx_fal_requests_user_id').on(table.userId),
    modelIdx: index('idx_fal_requests_model').on(table.model),
    statusIdx: index('idx_fal_requests_status').on(table.status),
    createdAtIdx: index('idx_fal_requests_created_at').on(table.createdAt),
  })
);

/**
 * LetzAI requests tracking
 * Tracks all requests to LetzAI for usage monitoring and cost calculation
 */
export const letzaiRequests = pgTable(
  'letzai_requests',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobId: text('job_id'), // LetzAI job ID for tracking
    teamId: uuid('team_id').references(() => teams.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    endpoint: text('endpoint').notNull(), // /images, /image-edits, /upscale, etc.
    model: text('model'), // Model used if applicable
    requestPayload: jsonb('request_payload')
      .$type<Record<string, unknown>>()
      .notNull(),
    status: text('status', { enum: letzaiRequestStatusEnum })
      .notNull()
      .default('pending'),
    responseData: jsonb('response_data').$type<Record<string, unknown>>(),
    error: text('error'),
    costCredits: decimal('cost_credits', { precision: 10, scale: 4 }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    teamIdIdx: index('idx_letzai_requests_team_id').on(table.teamId),
    userIdIdx: index('idx_letzai_requests_user_id').on(table.userId),
    statusIdx: index('idx_letzai_requests_status').on(table.status),
    jobIdIdx: index('idx_letzai_requests_job_id').on(table.jobId),
    createdAtIdx: index('idx_letzai_requests_created_at').on(table.createdAt),
    endpointIdx: index('idx_letzai_requests_endpoint').on(table.endpoint),
    teamStatusCreatedIdx: index('idx_letzai_requests_team_status_created').on(
      table.teamId,
      table.status,
      table.createdAt
    ),
  })
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
