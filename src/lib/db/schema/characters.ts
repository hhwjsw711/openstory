/**
 * Character Library Schema
 * Team-level character library with multiple sheets and reference media
 */

import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import {
  type InferInsertModel,
  type InferSelectModel,
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
import { frames } from './frames';
import { sequences } from './sequences';
import { teams } from './teams';

// ============================================================================
// Enums / Constants
// ============================================================================

const CHARACTER_SHEET_SOURCES = [
  'script_analysis',
  'manual_upload',
  'ai_generated',
] as const;
export type CharacterSheetSource = (typeof CHARACTER_SHEET_SOURCES)[number];

const CHARACTER_MEDIA_TYPES = ['image', 'video', 'recording'] as const;
export type CharacterMediaType = (typeof CHARACTER_MEDIA_TYPES)[number];

// ============================================================================
// Characters Table (Core Identity)
// ============================================================================

// Note: Keep as 'library_characters' until old characters table from libraries.ts is dropped
export const libraryCharacters = sqliteTable(
  'library_characters',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(),
    description: text(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    isHumanGenerated: integer('is_human_generated', {
      mode: 'boolean',
    }).default(false),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_library_characters_team_id').on(table.teamId),
    index('idx_library_characters_name').on(table.name),
    index('idx_library_characters_is_favorite').on(table.isFavorite),
  ]
);

// ============================================================================
// Character Sheets Table (Different Looks/Appearances)
// ============================================================================

export const characterSheets = sqliteTable(
  'character_sheets',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    characterId: text('character_id')
      .notNull()
      .references(() => libraryCharacters.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(), // e.g., "casual outfit", "formal wear"
    imageUrl: text('image_url'),
    imagePath: text('image_path'), // R2 storage path
    metadata: text({ mode: 'json' }).$type<CharacterBibleEntry>(), // Full character details
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
    source: text()
      .$type<CharacterSheetSource>()
      .default('manual_upload')
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_character_sheets_character_id').on(table.characterId),
    index('idx_character_sheets_is_default').on(table.isDefault),
  ]
);

// ============================================================================
// Character Media Table (User Uploaded References)
// ============================================================================

export const characterMedia = sqliteTable(
  'character_media',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    characterId: text('character_id')
      .notNull()
      .references(() => libraryCharacters.id, { onDelete: 'cascade' }),
    type: text().$type<CharacterMediaType>().notNull(),
    url: text().notNull(),
    path: text(), // R2 storage path
    metadata: text({ mode: 'json' })
      .$type<Record<string, object>>()
      .default({}),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_character_media_character_id').on(table.characterId),
    index('idx_character_media_type').on(table.type),
  ]
);

// ============================================================================
// Sequence Character Usages Table (Links Characters to Sequences)
// ============================================================================

export const sequenceCharacterUsages = sqliteTable(
  'sequence_character_usages',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    characterId: text('character_id')
      .notNull()
      .references(() => libraryCharacters.id, { onDelete: 'cascade' }),
    characterSheetId: text('character_sheet_id').references(
      () => characterSheets.id,
      { onDelete: 'set null' }
    ),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    sceneId: text('scene_id'), // Optional: specific scene
    frameId: text('frame_id').references(() => frames.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_sequence_character_usages_character_id').on(table.characterId),
    index('idx_sequence_character_usages_sequence_id').on(table.sequenceId),
    index('idx_sequence_character_usages_frame_id').on(table.frameId),
    // Unique: one character usage per sequence/scene combination
    uniqueIndex('sequence_character_usages_seq_scene_char_key').on(
      table.sequenceId,
      table.sceneId,
      table.characterId
    ),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const libraryCharactersRelations = relations(
  libraryCharacters,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [libraryCharacters.teamId],
      references: [teams.id],
    }),
    createdByUser: one(user, {
      fields: [libraryCharacters.createdBy],
      references: [user.id],
    }),
    sheets: many(characterSheets),
    media: many(characterMedia),
    usages: many(sequenceCharacterUsages),
  })
);

export const characterSheetsRelations = relations(
  characterSheets,
  ({ one }) => ({
    character: one(libraryCharacters, {
      fields: [characterSheets.characterId],
      references: [libraryCharacters.id],
    }),
  })
);

export const characterMediaRelations = relations(characterMedia, ({ one }) => ({
  character: one(libraryCharacters, {
    fields: [characterMedia.characterId],
    references: [libraryCharacters.id],
  }),
}));

export const sequenceCharacterUsagesRelations = relations(
  sequenceCharacterUsages,
  ({ one }) => ({
    character: one(libraryCharacters, {
      fields: [sequenceCharacterUsages.characterId],
      references: [libraryCharacters.id],
    }),
    sheet: one(characterSheets, {
      fields: [sequenceCharacterUsages.characterSheetId],
      references: [characterSheets.id],
    }),
    sequence: one(sequences, {
      fields: [sequenceCharacterUsages.sequenceId],
      references: [sequences.id],
    }),
    frame: one(frames, {
      fields: [sequenceCharacterUsages.frameId],
      references: [frames.id],
    }),
  })
);

// ============================================================================
// Type Exports
// ============================================================================

export type LibraryCharacter = InferSelectModel<typeof libraryCharacters>;
export type NewLibraryCharacter = InferInsertModel<typeof libraryCharacters>;

export type CharacterSheet = InferSelectModel<typeof characterSheets>;
export type NewCharacterSheet = InferInsertModel<typeof characterSheets>;

export type CharacterMediaRecord = InferSelectModel<typeof characterMedia>;
export type NewCharacterMedia = InferInsertModel<typeof characterMedia>;

export type SequenceCharacterUsage = InferSelectModel<
  typeof sequenceCharacterUsages
>;
export type NewSequenceCharacterUsage = InferInsertModel<
  typeof sequenceCharacterUsages
>;

// Composite types for API responses
export type LibraryCharacterWithSheets = LibraryCharacter & {
  sheets: CharacterSheet[];
  sheetCount: number;
  defaultSheet: CharacterSheet | null;
};

export type LibraryCharacterWithRelations = LibraryCharacter & {
  sheets: CharacterSheet[];
  media: CharacterMediaRecord[];
  usages: SequenceCharacterUsage[];
};
