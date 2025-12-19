/**
 * Character Sheets Schema
 * Role-specific looks/costumes for characters in a sequence
 */

import {
  type InferInsertModel,
  type InferSelectModel,
  relations,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { characters } from './characters';

const CHARACTER_SHEET_SOURCES = [
  'manual_upload',
  'ai_generated',
  'from_talent_sheet',
] as const;
export type CharacterSheetSource = (typeof CHARACTER_SHEET_SOURCES)[number];

/**
 * Character Sheets table
 * Stores different looks/costumes for a character within a sequence
 * e.g., "casual", "action scene", "formal dinner"
 */
export const characterSheets = sqliteTable(
  'character_sheets',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    name: text({ length: 255 }).notNull(), // e.g., "casual", "action scene"
    imageUrl: text('image_url'),
    imagePath: text('image_path'), // R2 storage path
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

// Relations
export const characterSheetsRelations = relations(
  characterSheets,
  ({ one }) => ({
    character: one(characters, {
      fields: [characterSheets.characterId],
      references: [characters.id],
    }),
  })
);

// Type exports
export type CharacterSheet = InferSelectModel<typeof characterSheets>;
export type NewCharacterSheet = InferInsertModel<typeof characterSheets>;
