import {
  characterMedia,
  characterSheets,
  libraryCharacters,
} from '@/lib/db/schema';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Shared Zod schemas for character library operations
 */

// Character schemas
export const createCharacterSchema = createInsertSchema(libraryCharacters, {
  name: z.string().min(1).max(255),
  description: z.string().optional(),
}).omit({
  id: true,
  teamId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCharacterSchema = createUpdateSchema(libraryCharacters).omit(
  {
    id: true,
    teamId: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  }
);

// Character sheet schemas
export const createCharacterSheetSchema = createInsertSchema(characterSheets, {
  name: z.string().min(1).max(255),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCharacterSheetSchema = createUpdateSchema(
  characterSheets
).omit({
  id: true,
  characterId: true,
  createdAt: true,
  updatedAt: true,
});

// Character media schemas
export const createCharacterMediaSchema = createInsertSchema(characterMedia, {
  url: z.string().url(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Filter schemas
export const listCharactersFilterSchema = z.object({
  favoritesOnly: z.boolean().optional(),
  sequenceId: z.string().optional(),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CreateCharacterSheetInput = z.infer<
  typeof createCharacterSheetSchema
>;
export type UpdateCharacterSheetInput = z.infer<
  typeof updateCharacterSheetSchema
>;
export type CreateCharacterMediaInput = z.infer<
  typeof createCharacterMediaSchema
>;
export type ListCharactersFilter = z.infer<typeof listCharactersFilterSchema>;
