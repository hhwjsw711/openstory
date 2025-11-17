/**
 * Sequences and Frames Schema
 * Core content creation entities for video sequences
 */

import {
  AspectRatio,
  DEFAULT_ASPECT_RATIO,
} from '@/lib/constants/aspect-ratios';
import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import type { Scene } from '@/lib/script';
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
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { styles } from './libraries';
import { teams } from './teams';

// Enums
export const sequenceStatus = pgEnum('sequence_status', [
  'draft',
  'processing',
  'completed',
  'failed',
  'archived',
]);

export const frameGenerationStatus = pgEnum('frame_generation_status', [
  'pending',
  'generating',
  'completed',
  'failed',
]);

/**
 * Type for sequence metadata JSONB field
 */
export type SequenceMetadata = {
  characterBible?: unknown; // Character bible structure from script analysis
  [key: string]: unknown; // Allow other fields
};

/**
 * Sequences table
 * Main video sequence/project entity
 */
export const sequences = pgTable(
  'sequences',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    teamId: uuid('team_id').notNull(),
    title: varchar({ length: 500 }).notNull(),
    script: text(),
    status: sequenceStatus().default('draft').notNull(),
    metadata: jsonb().$type<SequenceMetadata>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    styleId: uuid('style_id').notNull(),
    aspectRatio: varchar('aspect_ratio', { length: 10 })
      .$type<AspectRatio>()
      .default(DEFAULT_ASPECT_RATIO)
      .notNull(),
    analysisModel: varchar('analysis_model', { length: 100 })
      .default('anthropic/claude-haiku-4.5')
      .notNull(),
    analysisDurationMs: integer('analysis_duration_ms').default(0).notNull(),
  },
  (table) => [
    index('idx_sequences_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_sequences_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops')
    ),
    index('idx_sequences_style_id').using(
      'btree',
      table.styleId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_sequences_team_id').using(
      'btree',
      table.teamId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: 'sequences_team_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: 'sequences_created_by_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [user.id],
      name: 'sequences_updated_by_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.styleId],
      foreignColumns: [styles.id],
      name: 'sequences_style_id_fkey',
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
 * Frames table
 * Individual frames/shots within a sequence
 *
 * Each frame represents one scene from script analysis and stores:
 * - Visual content (thumbnailUrl for image, videoUrl for motion)
 * - Scene data in metadata field (populated progressively across 5 phases)
 * - Generation tracking information
 *
 * @see src/lib/ai/scene-analysis.schema.ts for Scene structure
 */
export const frames = pgTable(
  'frames',
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    sequenceId: uuid('sequence_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    description: text(),
    durationMs: integer('duration_ms').default(3000),
    thumbnailUrl: text('thumbnail_url'),
    thumbnailPath: text('thumbnail_path'), // R2 storage path (not signed URL)
    videoUrl: text('video_url'),
    videoPath: text('video_path'), // R2 storage path (not signed URL)
    // Thumbnail generation status tracking
    thumbnailStatus:
      frameGenerationStatus('thumbnail_status').default('pending'),
    thumbnailWorkflowRunId: text('thumbnail_workflow_run_id'),
    thumbnailGeneratedAt: timestamp('thumbnail_generated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    thumbnailError: text('thumbnail_error'),
    imageModel: varchar('image_model', { length: 100 })
      .default(DEFAULT_IMAGE_MODEL)
      .notNull(), // Model used for image generation
    // Video/motion generation status tracking
    videoStatus: frameGenerationStatus('video_status').default('pending'),
    videoWorkflowRunId: text('video_workflow_run_id'),
    videoGeneratedAt: timestamp('video_generated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    videoError: text('video_error'),
    /**
     * Stores Scene data at various stages of progressive analysis.
     * Fields are populated progressively across 5 phases.
     * @see src/lib/ai/scene-analysis.schema.ts for Scene structure
     */
    metadata: jsonb().$type<Scene>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_frames_order').using(
      'btree',
      table.sequenceId.asc().nullsLast().op('uuid_ops'),
      table.orderIndex.asc().nullsLast().op('int4_ops')
    ),
    index('idx_frames_sequence_id').using(
      'btree',
      table.sequenceId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.sequenceId],
      foreignColumns: [sequences.id],
      name: 'frames_sequence_id_fkey',
    }).onDelete('cascade'),
    unique('frames_sequence_id_order_index_key').on(
      table.sequenceId,
      table.orderIndex
    ),
    pgPolicy('Service role bypass', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`true`,
    }),
  ]
);

// Relations
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  team: one(teams, {
    fields: [sequences.teamId],
    references: [teams.id],
  }),
  user_createdBy: one(user, {
    fields: [sequences.createdBy],
    references: [user.id],
    relationName: 'sequences_createdBy_users_id',
  }),
  user_updatedBy: one(user, {
    fields: [sequences.updatedBy],
    references: [user.id],
    relationName: 'sequences_updatedBy_users_id',
  }),
  style: one(styles, {
    fields: [sequences.styleId],
    references: [styles.id],
  }),
  frames: many(frames),
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
export type UpdateSequence = Partial<Sequence>;

// Override the inferred Frame type to use Scene for metadata
type InferredFrame = InferSelectModel<typeof frames>;
export type Frame = Omit<InferredFrame, 'metadata'> & {
  metadata: Scene | null; // Nullable until script analysis completes, fields populate progressively
};

type InferredNewFrame = InferInsertModel<typeof frames>;
export type NewFrame = Omit<InferredNewFrame, 'metadata'> & {
  metadata?: Scene | null; // Optional - can be null initially, populated during script analysis
};

// Enum type exports
export type SequenceStatus = (typeof sequenceStatus.enumValues)[number];
