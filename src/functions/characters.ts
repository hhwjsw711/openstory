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
  createCharacterMediaRecord,
  createCharacterSheet,
  deleteCharacter,
  deleteCharacterMediaRecord,
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
import {
  STORAGE_BUCKETS,
  uploadFile,
  deleteFile,
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import type { LibraryCharacterSheetWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
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

// ============================================================================
// Character Media Operations
// ============================================================================

const uploadMediaInputSchema = z.object({
  characterId: ulidSchema,
  type: z.enum(['image', 'video', 'recording']),
  base64Data: z.string(),
  filename: z.string(),
});

/**
 * Upload character reference media
 */
export const uploadCharacterMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(uploadMediaInputSchema))
  .handler(async ({ context, data }) => {
    // Verify character belongs to team
    const character = await getCharacterById(data.characterId);

    if (!character || character.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    // Decode base64 data
    const base64Content = data.base64Data.split(',')[1] ?? data.base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const blob = new Blob([buffer]);

    // Generate storage path
    const ext = getExtensionFromUrl(data.filename);
    const mediaId = generateId();
    const storagePath = `${context.teamId}/${data.characterId}/${mediaId}.${ext}`;

    // Upload to R2
    const result = await uploadFile(
      STORAGE_BUCKETS.CHARACTERS,
      storagePath,
      blob,
      {
        contentType: getMimeTypeFromExtension(ext),
      }
    );

    // Create database record
    const media = await createCharacterMediaRecord({
      id: mediaId,
      characterId: data.characterId,
      type: data.type,
      url: result.publicUrl,
      path: result.path,
    });

    return media;
  });

const deleteMediaInputSchema = z.object({
  mediaId: ulidSchema,
});

/**
 * Delete character reference media
 */
export const deleteCharacterMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteMediaInputSchema))
  .handler(async ({ context, data }) => {
    // Get media record via direct query
    const { getDb } = await import('#db-client');
    const { characterMedia } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const media = await getDb().query.characterMedia.findFirst({
      where: eq(characterMedia.id, data.mediaId),
    });

    if (!media) {
      throw new Error('Media not found');
    }

    // Verify character belongs to team
    const character = await getCharacterById(media.characterId);

    if (!character || character.teamId !== context.teamId) {
      throw new Error('Media not found');
    }

    // Delete from storage if path exists
    if (media.path) {
      try {
        await deleteFile(
          STORAGE_BUCKETS.CHARACTERS,
          media.path.replace('characters/', '')
        );
      } catch {
        // Ignore storage deletion errors
      }
    }

    // Delete database record
    const deleted = await deleteCharacterMediaRecord(data.mediaId);

    if (!deleted) {
      throw new Error('Failed to delete media');
    }

    return { success: true };
  });

// ============================================================================
// Generate Character Sheet
// ============================================================================

const generateSheetInputSchema = z.object({
  characterId: ulidSchema,
  sheetName: z.string().optional(),
});

/**
 * Generate a character sheet from reference media
 * Triggers the library-character-sheet workflow
 */
export const generateCharacterSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(generateSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get character with relations to check for media
    const character = await getCharacterWithRelations(data.characterId);

    if (!character) {
      throw new Error('Character not found');
    }

    if (character.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    // Check that character has reference media
    const imageMedia = character.media?.filter((m) => m.type === 'image') ?? [];
    if (imageMedia.length === 0) {
      throw new Error(
        'Character must have at least one reference image to generate a sheet'
      );
    }

    // Get reference image URLs
    const referenceImageUrls = imageMedia.map((m) => m.url);

    // Trigger the workflow
    const workflowInput: LibraryCharacterSheetWorkflowInput = {
      userId: context.user.id,
      teamId: context.teamId,
      characterId: character.id,
      characterName: character.name,
      characterDescription: character.description ?? undefined,
      referenceImageUrls,
      sheetName: data.sheetName,
    };

    const runId = await triggerWorkflow(
      '/library-character-sheet',
      workflowInput
    );

    return { runId };
  });
