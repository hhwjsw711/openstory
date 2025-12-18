/**
 * Frame Characters Schema
 * Junction table linking frames to characters (which characters appear in each frame)
 */

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
import { characterSheets } from './character-sheets';
import { characters } from './characters';
import { frames } from './frames';

/**
 * Frame Characters junction table
 * Tracks which characters appear in which frames, and optionally
 * which specific character sheet (look/costume) was used
 */
export const frameCharacters = sqliteTable(
  'frame_characters',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    frameId: text('frame_id')
      .notNull()
      .references(() => frames.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    // Optional: specific look/costume used for this frame
    characterSheetId: text('character_sheet_id').references(
      () => characterSheets.id,
      { onDelete: 'set null' }
    ),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_frame_characters_frame_id').on(table.frameId),
    index('idx_frame_characters_character_id').on(table.characterId),
    // Each character can only appear once per frame
    uniqueIndex('frame_characters_frame_character_key').on(
      table.frameId,
      table.characterId
    ),
  ]
);

// Relations
export const frameCharactersRelations = relations(
  frameCharacters,
  ({ one }) => ({
    frame: one(frames, {
      fields: [frameCharacters.frameId],
      references: [frames.id],
    }),
    character: one(characters, {
      fields: [frameCharacters.characterId],
      references: [characters.id],
    }),
    characterSheet: one(characterSheets, {
      fields: [frameCharacters.characterSheetId],
      references: [characterSheets.id],
    }),
  })
);

// Type exports
export type FrameCharacter = InferSelectModel<typeof frameCharacters>;
export type NewFrameCharacter = InferInsertModel<typeof frameCharacters>;

// Composite types for API responses
export type FrameCharacterWithDetails = FrameCharacter & {
  character: {
    id: string;
    name: string;
    characterId: string;
    sheetImageUrl: string | null;
  };
  characterSheet: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
};
