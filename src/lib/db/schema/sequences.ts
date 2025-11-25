/**
 * Sequences and Frames Schema
 * Core content creation entities for video sequences
 */

import { DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import {
  AspectRatio,
  DEFAULT_ASPECT_RATIO,
} from '@/lib/constants/aspect-ratios';
import type { Scene } from '@/lib/script';
import {
  desc,
  InferInsertModel,
  InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';
import { styles } from './libraries';
import { teams } from './teams';

// Enum values as constants (SQLite doesn't have native enums)
export const SEQUENCE_STATUSES = [
  'draft',
  'processing',
  'completed',
  'failed',
  'archived',
] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const FRAME_GENERATION_STATUSES = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;
export type FrameGenerationStatus = (typeof FRAME_GENERATION_STATUSES)[number];

/**
 * Type for sequence metadata JSON field
 */
export type SequenceMetadata = {
  characterBible?: unknown; // Character bible structure from script analysis
  [key: string]: unknown; // Allow other fields
};

/**
 * Sequences table
 * Main video sequence/project entity
 */
export const sequences = sqliteTable(
  'sequences',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: text({ length: 500 }).notNull(),
    script: text(),
    status: text().$type<SequenceStatus>().default('draft').notNull(),
    metadata: text({ mode: 'json' })
      .$type<SequenceMetadata>()
      .$defaultFn(() => ({})),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    updatedBy: text('updated_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    styleId: text('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'set null' }),
    aspectRatio: text('aspect_ratio', { length: 10 })
      .$type<AspectRatio>()
      .default(DEFAULT_ASPECT_RATIO)
      .notNull(),
    analysisModel: text('analysis_model', { length: 100 })
      .default('anthropic/claude-haiku-4.5')
      .notNull(),
    analysisDurationMs: integer('analysis_duration_ms').default(0).notNull(),
    imageModel: text('image_model', { length: 100 })
      .default(DEFAULT_IMAGE_MODEL)
      .notNull(),
    videoModel: text('video_model', { length: 100 })
      .default(DEFAULT_VIDEO_MODEL)
      .notNull(),
  },
  (table) => [
    index('idx_sequences_created_at').on(desc(table.createdAt)),
    index('idx_sequences_status').on(table.status),
    index('idx_sequences_style_id').on(table.styleId),
    index('idx_sequences_team_id').on(table.teamId),
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
export const frames = sqliteTable(
  'frames',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    description: text(),
    durationMs: integer('duration_ms').default(3000),
    thumbnailUrl: text('thumbnail_url'),
    thumbnailPath: text('thumbnail_path'), // R2 storage path (not signed URL)
    videoUrl: text('video_url'),
    videoPath: text('video_path'), // R2 storage path (not signed URL)
    // Thumbnail generation status tracking
    thumbnailStatus: text('thumbnail_status')
      .$type<FrameGenerationStatus>()
      .default('pending'),
    thumbnailWorkflowRunId: text('thumbnail_workflow_run_id'),
    thumbnailGeneratedAt: integer('thumbnail_generated_at', {
      mode: 'timestamp',
    }),
    thumbnailError: text('thumbnail_error'),
    imageModel: text('image_model', { length: 100 })
      .default(DEFAULT_IMAGE_MODEL)
      .notNull(), // Model used for image generation
    imagePrompt: text('image_prompt'), // User-updated image prompt (overrides AI-generated prompt from metadata)
    // Video/motion generation status tracking
    videoStatus: text('video_status')
      .$type<FrameGenerationStatus>()
      .default('pending'),
    videoWorkflowRunId: text('video_workflow_run_id'),
    videoGeneratedAt: integer('video_generated_at', {
      mode: 'timestamp',
    }),
    videoError: text('video_error'),
    motionPrompt: text('motion_prompt'), // User-updated motion prompt (overrides AI-generated prompt from metadata)
    motionModel: text('motion_model', { length: 100 }), // Model used for motion/video generation (nullable - inherits from sequence if not set)
    /**
     * Stores Scene data at various stages of progressive analysis.
     * Fields are populated progressively across 5 phases.
     * @see src/lib/ai/scene-analysis.schema.ts for Scene structure
     */
    metadata: text({ mode: 'json' }).$type<Scene>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Compound index for efficient ordering queries
    index('idx_frames_order').on(table.sequenceId, table.orderIndex),
    index('idx_frames_sequence_id').on(table.sequenceId),
    // Unique constraint: one frame per sequence/order combination
    uniqueIndex('frames_sequence_id_order_index_key').on(
      table.sequenceId,
      table.orderIndex
    ),
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
