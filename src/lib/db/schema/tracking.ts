/**
 * API Request Tracking Schema
 * Tracks Fal.ai and LetzAI API usage for cost calculation and monitoring
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { teams } from './teams';

// Enums
export const falRequestStatus = pgEnum('fal_request_status', [
  'pending',
  'completed',
  'failed',
]);

export const letzaiRequestStatus = pgEnum('letzai_request_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

/**
 * Fal.ai requests tracking
 * Tracks all requests to Fal.ai for usage monitoring and cost calculation
 */
export const falRequests = pgTable(
  'fal_requests',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    jobId: uuid('job_id'),
    teamId: uuid('team_id'),
    userId: uuid('user_id'),
    model: varchar({ length: 255 }).notNull(),
    requestPayload: jsonb('request_payload').default({}).notNull(),
    responseData: jsonb('response_data'),
    costCredits: numeric('cost_credits', { precision: 10, scale: 4 }).default(
      '0'
    ),
    latencyMs: integer('latency_ms'),
    status: falRequestStatus().default('pending').notNull(),
    error: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_fal_requests_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_fal_requests_job_id').using(
      'btree',
      table.jobId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_fal_requests_model').using(
      'btree',
      table.model.asc().nullsLast().op('text_ops')
    ),
    index('idx_fal_requests_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops')
    ),
    index('idx_fal_requests_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_fal_requests_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'fal_requests_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'fal_requests_user_id_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

/**
 * LetzAI requests tracking
 * Tracks all requests to LetzAI for usage monitoring and cost calculation
 */
export const letzaiRequests = pgTable(
  'letzai_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    jobId: text('job_id'),
    teamId: uuid('team_id'),
    userId: uuid('user_id'),
    endpoint: text().notNull(),
    model: text(),
    requestPayload: jsonb('request_payload').notNull(),
    status: letzaiRequestStatus().default('pending').notNull(),
    responseData: jsonb('response_data'),
    error: text(),
    costCredits: numeric('cost_credits', { precision: 10, scale: 4 }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => [
    index('idx_letzai_requests_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops')
    ),
    index('idx_letzai_requests_endpoint').using(
      'btree',
      table.endpoint.asc().nullsLast().op('text_ops')
    ),
    index('idx_letzai_requests_job_id').using(
      'btree',
      table.jobId.asc().nullsLast().op('text_ops')
    ),
    index('idx_letzai_requests_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops')
    ),
    index('idx_letzai_requests_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_letzai_requests_team_status_created').using(
      'btree',
      table.teamId.asc().nullsLast().op('timestamptz_ops'),
      table.status.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('enum_ops')
    ),
    index('idx_letzai_requests_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'letzai_requests_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'letzai_requests_user_id_fkey',
    }).onDelete('set null'),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

// Relations
export const falRequestsRelations = relations(falRequests, ({ one }) => ({
  team: one(teams, {
    fields: [falRequests.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [falRequests.userId],
    references: [users.id],
  }),
}));

export const letzaiRequestsRelations = relations(letzaiRequests, ({ one }) => ({
  team: one(teams, {
    fields: [letzaiRequests.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [letzaiRequests.userId],
    references: [users.id],
  }),
}));

// Type exports
export type FalRequest = InferSelectModel<typeof falRequests>;
export type NewFalRequest = InferInsertModel<typeof falRequests>;

export type LetzaiRequest = InferSelectModel<typeof letzaiRequests>;
export type NewLetzaiRequest = InferInsertModel<typeof letzaiRequests>;

// Enum type exports
export type FalRequestStatus = (typeof falRequestStatus.enumValues)[number];
export type LetzaiRequestStatus =
  (typeof letzaiRequestStatus.enumValues)[number];
