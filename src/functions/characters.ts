/**
 * Character Library Server Functions
 * End-to-end type-safe functions for character library operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authMiddleware, authWithTeamMiddleware } from './middleware';
import {
  createCharacterSchema,
  updateCharacterSchema,
  createCharacterSheetSchema,
  listCharactersFilterSchema,
} from '@/lib/schemas/character.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  createCharacter,
  createCharacterSheet,
  deleteCharacter,
  deleteCharacterSheet,
  getCharacterById,
  getCharactersForSequence,
  getCharacterSheetById,
  getCharacterWithRelations,
  getTeamCharacters,
  requireTeamManagement,
  toggleCharacterFavorite,
  updateCharacter,
} from '@/lib/db/helpers';
import type {
  CharacterSheetSource,
  CharacterWithSheets,
} from '@/lib/db/schema';

// ============================================================================
// List Characters
// ============================================================================

/**
 * Get all characters for the user's team
 * Optionally filter by favorites or sequence usage
 */
export const getCharactersFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(listCharactersFilterSchema.optional()))
  .handler(async ({ context, data }): Promise<CharacterWithSheets[]> => {
    // If filtering by sequence, get characters used in that sequence
    if (data?.sequenceId) {
      return getCharactersForSequence(context.teamId, data.sequenceId);
    }

    // Otherwise get all team characters
    return getTeamCharacters(context.teamId, {
      favoritesOnly: data?.favoritesOnly,
    });
  });

// ============================================================================
// Get Single Character
// ============================================================================

const getCharacterInputSchema = z.object({
  characterId: ulidSchema,
});

/**
 * Get a single character with all sheets and media
 */
export const getCharacterFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(getCharacterInputSchema))
  .handler(async ({ context, data }) => {
    const character = await getCharacterWithRelations(data.characterId);

    if (!character) {
      throw new Error('Character not found');
    }

    // Verify team ownership
    if (character.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    return character;
  });

// ============================================================================
// Create Character
// ============================================================================

/**
 * Create a new character in the team library
 */
export const createCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createCharacterSchema))
  .handler(async ({ context, data }) => {
    return createCharacter({
      teamId: context.teamId,
      name: data.name,
      description: data.description,
      isFavorite: data.isFavorite ?? false,
      isHumanGenerated: data.isHumanGenerated ?? false,
      createdBy: context.user.id,
    });
  });

// ============================================================================
// Update Character
// ============================================================================

const updateCharacterInputSchema = updateCharacterSchema.extend({
  characterId: ulidSchema,
});

/**
 * Update a character
 */
export const updateCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(updateCharacterInputSchema))
  .handler(async ({ context, data }) => {
    const { characterId, ...updateData } = data;

    const character = await updateCharacter(
      characterId,
      context.teamId,
      updateData
    );

    if (!character) {
      throw new Error('Character not found or you do not have permission');
    }

    return character;
  });

// ============================================================================
// Delete Character
// ============================================================================

const deleteCharacterInputSchema = z.object({
  characterId: ulidSchema,
});

/**
 * Delete a character (requires admin/owner role)
 */
export const deleteCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(deleteCharacterInputSchema))
  .handler(async ({ context, data }) => {
    const character = await getCharacterById(data.characterId);

    if (!character) {
      throw new Error('Character not found');
    }

    // Check if user has admin/owner role for this team
    await requireTeamManagement(context.user.id, character.teamId);

    const deleted = await deleteCharacter(data.characterId, character.teamId);

    if (!deleted) {
      throw new Error('Failed to delete character');
    }

    return { success: true };
  });

// ============================================================================
// Toggle Favorite
// ============================================================================

const toggleFavoriteInputSchema = z.object({
  characterId: ulidSchema,
});

/**
 * Toggle character favorite status
 */
export const toggleCharacterFavoriteFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(toggleFavoriteInputSchema))
  .handler(async ({ context, data }) => {
    const character = await toggleCharacterFavorite(
      data.characterId,
      context.teamId
    );

    if (!character) {
      throw new Error('Character not found or you do not have permission');
    }

    return character;
  });

// ============================================================================
// Character Sheet Operations
// ============================================================================

/**
 * Create a character sheet
 */
export const createCharacterSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createCharacterSheetSchema))
  .handler(async ({ context, data }) => {
    // Verify character belongs to team
    const character = await getCharacterById(data.characterId);

    if (!character || character.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    return createCharacterSheet({
      characterId: data.characterId,
      name: data.name,
      imageUrl: data.imageUrl,
      imagePath: data.imagePath,
      metadata: data.metadata,
      isDefault: data.isDefault ?? false,
      source: (data.source ?? 'manual_upload') as CharacterSheetSource,
    });
  });

const deleteSheetInputSchema = z.object({
  sheetId: ulidSchema,
});

/**
 * Delete a character sheet
 */
export const deleteCharacterSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get sheet with character to verify team ownership
    const sheet = await getCharacterSheetById(data.sheetId);

    if (!sheet) {
      throw new Error('Sheet not found');
    }

    const character = await getCharacterById(sheet.characterId);

    if (!character || character.teamId !== context.teamId) {
      throw new Error('Sheet not found');
    }

    const deleted = await deleteCharacterSheet(data.sheetId);

    if (!deleted) {
      throw new Error('Failed to delete sheet');
    }

    return { success: true };
  });
