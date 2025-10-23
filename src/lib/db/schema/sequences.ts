/**
 * Sequences and Frames Schema
 * Core content creation entities for video sequences
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { teams } from './teams';
import { users } from './users';
import { styles } from './libraries';

// Enums
export const sequenceStatusEnum = [
  'draft',
  'processing',
  'completed',
  'failed',
  'archived',
] as const;
export type SequenceStatus = (typeof sequenceStatusEnum)[number];

/**
 * Sequences table
 * Main video sequence/project entity
 */
export const sequences = pgTable(
  'sequences',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    script: text('script'),
    status: text('status', { enum: sequenceStatusEnum })
      .notNull()
      .default('draft'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    styleId: uuid('style_id').references(() => styles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    teamIdIdx: index('idx_sequences_team_id').on(table.teamId),
    statusIdx: index('idx_sequences_status').on(table.status),
    createdAtIdx: index('idx_sequences_created_at').on(table.createdAt),
    styleIdIdx: index('idx_sequences_style_id').on(table.styleId),
  })
);

/**
 * Frames table
 * Individual frames/shots within a sequence
 */
export const frames = pgTable(
  'frames',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    description: text('description'),
    durationMs: integer('duration_ms').default(3000),
    thumbnailUrl: text('thumbnail_url'),
    videoUrl: text('video_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sequenceIdIdx: index('idx_frames_sequence_id').on(table.sequenceId),
    orderIdx: index('idx_frames_order').on(table.sequenceId, table.orderIndex),
    sequenceOrderUnique: unique('frames_sequence_id_order_index_key').on(
      table.sequenceId,
      table.orderIndex
    ),
  })
);

// Relations
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  team: one(teams, {
    fields: [sequences.teamId],
    references: [teams.id],
  }),
  createdByUser: one(users, {
    fields: [sequences.createdBy],
    references: [users.id],
    relationName: 'sequencesCreatedBy',
  }),
  updatedByUser: one(users, {
    fields: [sequences.updatedBy],
    references: [users.id],
    relationName: 'sequencesUpdatedBy',
  }),
  frames: many(frames),
  style: one(styles, {
    fields: [sequences.styleId],
    references: [styles.id],
  }),
}));

export const framesRelations = relations(frames, ({ one }) => ({
  sequence: one(sequences, {
    fields: [frames.sequenceId],
    references: [sequences.id],
  }),
}));

// Type exports
export type Sequence = InferSelectModel<typeof sequences>;
export type NewSequence = InferInsertModel<typeof sequences>;

export type Frame = InferSelectModel<typeof frames>;
export type NewFrame = InferInsertModel<typeof frames>;
