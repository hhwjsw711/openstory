/**
 * Sequence Characters Schema
 * Characters extracted from scripts, with generated reference sheet images
 */

import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { sequences } from './sequences';

export const SHEET_STATUSES = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

/**
 * Sequence Characters table
 * Stores characters extracted from a sequence's script with their generated reference sheets
 */
export const sequenceCharacters = sqliteTable(
  'sequence_characters',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(), // From CharacterBibleEntry.characterId
    name: text({ length: 255 }).notNull(),
    // Full character bible entry metadata
    metadata: text({ mode: 'json' }).$type<CharacterBibleEntry>().notNull(),
    // Character sheet image (full body turnaround)
    sheetImageUrl: text('sheet_image_url'),
    sheetImagePath: text('sheet_image_path'), // R2 storage path
    // Generation status tracking
    sheetStatus: text('sheet_status')
      .$type<SheetStatus>()
      .default('pending')
      .notNull(),
    sheetWorkflowRunId: text('sheet_workflow_run_id'),
    sheetGeneratedAt: integer('sheet_generated_at', { mode: 'timestamp' }),
    sheetError: text('sheet_error'),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_sequence_characters_sequence_id').on(table.sequenceId),
    // Unique constraint: one character per sequence/characterId combination
    uniqueIndex('sequence_characters_sequence_character_key').on(
      table.sequenceId,
      table.characterId
    ),
  ]
);

// Relations
export const sequenceCharactersRelations = relations(
  sequenceCharacters,
  ({ one }) => ({
    sequence: one(sequences, {
      fields: [sequenceCharacters.sequenceId],
      references: [sequences.id],
    }),
  })
);

// Type exports
export type SequenceCharacter = InferSelectModel<typeof sequenceCharacters>;
export type NewSequenceCharacter = InferInsertModel<typeof sequenceCharacters>;
