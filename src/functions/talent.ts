/**
 * Talent Library Server Functions
 * End-to-end type-safe functions for talent library operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authMiddleware, authWithTeamMiddleware } from './middleware';
import {
  createTalentSchema,
  updateTalentSchema,
  createTalentSheetSchema,
  listTalentFilterSchema,
} from '@/lib/schemas/talent.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  createTalent,
  createTalentMediaRecord,
  createTalentSheet,
  deleteTalent,
  deleteTalentMediaRecord,
  deleteTalentSheet,
  getTalentById,
  getTalentSheetById,
  getTalentWithRelations,
  getTeamTalent,
  requireTeamManagement,
  toggleTalentFavorite,
  updateTalent,
  updateTalentSheet,
} from '@/lib/db/helpers';
import {
  STORAGE_BUCKETS,
  uploadFile,
  deleteFile,
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import type { LibraryTalentSheetWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import type { TalentSheetSource, TalentWithSheets } from '@/lib/db/schema';

// ============================================================================
// List Talent
// ============================================================================

/**
 * Get all talent for the user's team
 * Optionally filter by favorites
 */
export const getTalentFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(listTalentFilterSchema.optional()))
  .handler(async ({ context, data }): Promise<TalentWithSheets[]> => {
    return getTeamTalent(context.teamId, {
      favoritesOnly: data?.favoritesOnly,
    });
  });

// ============================================================================
// Get Single Talent
// ============================================================================

const getTalentInputSchema = z.object({
  talentId: ulidSchema,
});

/**
 * Get a single talent with all sheets and media
 */
export const getTalentByIdFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(getTalentInputSchema))
  .handler(async ({ context, data }) => {
    const talentRecord = await getTalentWithRelations(data.talentId);

    if (!talentRecord) {
      throw new Error('Talent not found');
    }

    // Verify team ownership
    if (talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    return talentRecord;
  });

// ============================================================================
// Create Talent
// ============================================================================

/**
 * Create a new talent in the team library
 * Automatically triggers talent sheet generation workflow
 */
export const createTalentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createTalentSchema))
  .handler(async ({ context, data }) => {
    const newTalent = await createTalent({
      teamId: context.teamId,
      name: data.name,
      description: data.description,
      isFavorite: data.isFavorite ?? false,
      isHuman: data.isHuman ?? false,
      createdBy: context.user.id,
    });

    // Automatically trigger talent sheet generation workflow
    // No reference images at creation time - will generate from name/description
    const workflowInput: LibraryTalentSheetWorkflowInput = {
      userId: context.user.id,
      teamId: context.teamId,
      talentId: newTalent.id,
      talentName: newTalent.name,
      talentDescription: newTalent.description ?? undefined,
      referenceImageUrls: [], // Empty - will generate from name/description
      sheetName: 'Default Sheet',
    };

    // Trigger workflow asynchronously (don't wait for completion)
    void triggerWorkflow('/library-talent-sheet', workflowInput).catch(
      (error) => {
        console.error(
          '[createTalentFn]',
          'Failed to trigger talent sheet workflow:',
          error
        );
      }
    );

    return newTalent;
  });

// ============================================================================
// Update Talent
// ============================================================================

const updateTalentInputSchema = updateTalentSchema.extend({
  talentId: ulidSchema,
});

/**
 * Update a talent
 */
export const updateTalentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(updateTalentInputSchema))
  .handler(async ({ context, data }) => {
    const { talentId, ...updateData } = data;

    const updated = await updateTalent(talentId, context.teamId, updateData);

    if (!updated) {
      throw new Error('Talent not found or you do not have permission');
    }

    return updated;
  });

// ============================================================================
// Delete Talent
// ============================================================================

const deleteTalentInputSchema = z.object({
  talentId: ulidSchema,
});

/**
 * Delete a talent (requires admin/owner role)
 */
export const deleteTalentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(deleteTalentInputSchema))
  .handler(async ({ context, data }) => {
    const talentRecord = await getTalentById(data.talentId);

    if (!talentRecord) {
      throw new Error('Talent not found');
    }

    // Check if user has admin/owner role for this team
    await requireTeamManagement(context.user.id, talentRecord.teamId);

    const deleted = await deleteTalent(data.talentId, talentRecord.teamId);

    if (!deleted) {
      throw new Error('Failed to delete talent');
    }

    return { success: true };
  });

// ============================================================================
// Toggle Favorite
// ============================================================================

const toggleFavoriteInputSchema = z.object({
  talentId: ulidSchema,
});

/**
 * Toggle talent favorite status
 */
export const toggleTalentFavoriteFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(toggleFavoriteInputSchema))
  .handler(async ({ context, data }) => {
    const updated = await toggleTalentFavorite(data.talentId, context.teamId);

    if (!updated) {
      throw new Error('Talent not found or you do not have permission');
    }

    return updated;
  });

// ============================================================================
// Talent Sheet Operations
// ============================================================================

/**
 * Create a talent sheet
 */
export const createTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createTalentSheetSchema))
  .handler(async ({ context, data }) => {
    // Verify talent belongs to team
    const talentRecord = await getTalentById(data.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    return createTalentSheet({
      talentId: data.talentId,
      name: data.name,
      imageUrl: data.imageUrl,
      imagePath: data.imagePath,
      metadata: data.metadata,
      isDefault: data.isDefault ?? false,
      source: (data.source ?? 'manual_upload') satisfies TalentSheetSource,
    });
  });

const deleteSheetInputSchema = z.object({
  sheetId: ulidSchema,
});

/**
 * Delete a talent sheet
 */
export const deleteTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get sheet with talent to verify team ownership
    const sheet = await getTalentSheetById(data.sheetId);

    if (!sheet) {
      throw new Error('Sheet not found');
    }

    const talentRecord = await getTalentById(sheet.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Sheet not found');
    }

    const deleted = await deleteTalentSheet(data.sheetId);

    if (!deleted) {
      throw new Error('Failed to delete sheet');
    }

    return { success: true };
  });

// ============================================================================
// Set Default Sheet
// ============================================================================

const setDefaultSheetInputSchema = z.object({
  sheetId: ulidSchema,
});

/**
 * Set a talent sheet as the default
 */
export const setDefaultSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(setDefaultSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get sheet with talent to verify team ownership
    const sheet = await getTalentSheetById(data.sheetId);

    if (!sheet) {
      throw new Error('Sheet not found');
    }

    const talentRecord = await getTalentById(sheet.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Sheet not found');
    }

    const updated = await updateTalentSheet(data.sheetId, { isDefault: true });

    if (!updated) {
      throw new Error('Failed to update sheet');
    }

    return updated;
  });

// ============================================================================
// Talent Media Operations
// ============================================================================

const uploadMediaInputSchema = z.object({
  talentId: ulidSchema,
  type: z.enum(['image', 'video', 'recording']),
  base64Data: z.string(),
  filename: z.string(),
});

/**
 * Upload talent reference media
 */
export const uploadTalentMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(uploadMediaInputSchema))
  .handler(async ({ context, data }) => {
    // Verify talent belongs to team
    const talentRecord = await getTalentById(data.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    // Decode base64 data
    const base64Content = data.base64Data.split(',')[1] ?? data.base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const blob = new Blob([buffer]);

    // Generate storage path
    const ext = getExtensionFromUrl(data.filename);
    const mediaId = generateId();
    const storagePath = `${context.teamId}/${data.talentId}/${mediaId}.${ext}`;

    // Upload to R2
    const result = await uploadFile(STORAGE_BUCKETS.TALENT, storagePath, blob, {
      contentType: getMimeTypeFromExtension(ext),
    });

    // Create database record
    const media = await createTalentMediaRecord({
      id: mediaId,
      talentId: data.talentId,
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
 * Delete talent reference media
 */
export const deleteTalentMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteMediaInputSchema))
  .handler(async ({ context, data }) => {
    // Get media record via direct query
    const { getDb } = await import('#db-client');
    const { talentMedia } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const media = await getDb().query.talentMedia.findFirst({
      where: eq(talentMedia.id, data.mediaId),
    });

    if (!media) {
      throw new Error('Media not found');
    }

    // Verify talent belongs to team
    const talentRecord = await getTalentById(media.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Media not found');
    }

    // Delete from storage if path exists
    if (media.path) {
      try {
        await deleteFile(
          STORAGE_BUCKETS.TALENT,
          media.path.replace('talent/', '')
        );
      } catch {
        // Ignore storage deletion errors
      }
    }

    // Delete database record
    const deleted = await deleteTalentMediaRecord(data.mediaId);

    if (!deleted) {
      throw new Error('Failed to delete media');
    }

    return { success: true };
  });

// ============================================================================
// Generate Talent Sheet
// ============================================================================

const generateSheetInputSchema = z.object({
  talentId: ulidSchema,
  sheetName: z.string().optional(),
});

/**
 * Generate a talent sheet from reference media
 * Triggers the library-talent-sheet workflow
 */
export const generateTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(generateSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get talent with relations to check for media
    const talentRecord = await getTalentWithRelations(data.talentId);

    if (!talentRecord) {
      throw new Error('Talent not found');
    }

    if (talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    // Check that talent has reference media
    const imageMedia =
      talentRecord.media?.filter((m) => m.type === 'image') ?? [];
    if (imageMedia.length === 0) {
      throw new Error(
        'Talent must have at least one reference image to generate a sheet'
      );
    }

    // Get reference image URLs
    const referenceImageUrls = imageMedia.map((m) => m.url);

    // Trigger the workflow
    const workflowInput: LibraryTalentSheetWorkflowInput = {
      userId: context.user.id,
      teamId: context.teamId,
      talentId: talentRecord.id,
      talentName: talentRecord.name,
      talentDescription: talentRecord.description ?? undefined,
      referenceImageUrls,
      sheetName: data.sheetName,
    };

    const runId = await triggerWorkflow('/library-talent-sheet', workflowInput);

    return { runId };
  });

// ============================================================================
// Add Character to Library
// ============================================================================

const addCharacterToLibraryInputSchema = z.object({
  characterId: ulidSchema,
});

/**
 * Add a sequence character to the team's talent library
 * Copies character data to create a new talent entry with optional sheet
 */
export const addCharacterToLibraryFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(addCharacterToLibraryInputSchema))
  .handler(async ({ context, data }) => {
    const { getDb } = await import('#db-client');
    const { characters, sequences } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    // Get the character with its sequence
    const character = await getDb().query.characters.findFirst({
      where: eq(characters.id, data.characterId),
    });

    if (!character) {
      throw new Error('Character not found');
    }

    // Verify team access via sequence
    const sequence = await getDb().query.sequences.findFirst({
      where: eq(sequences.id, character.sequenceId),
    });

    if (!sequence || sequence.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    // Create talent entry
    const newTalent = await createTalent({
      teamId: context.teamId,
      name: character.name,
      description: character.physicalDescription ?? undefined,
      imageUrl: character.sheetImageUrl ?? undefined,
      imagePath: character.sheetImagePath ?? undefined,
      isFavorite: false,
      isHuman: false,
      isInTeamLibrary: true,
      createdBy: context.user.id,
    });

    // If character has a sheet image, create a talent sheet
    if (character.sheetImageUrl) {
      await createTalentSheet({
        talentId: newTalent.id,
        name: 'Default',
        imageUrl: character.sheetImageUrl,
        imagePath: character.sheetImagePath ?? undefined,
        metadata: {
          characterId: character.characterId,
          name: character.name,
          age: character.age ?? undefined,
          gender: character.gender ?? undefined,
          ethnicity: character.ethnicity ?? undefined,
          physicalDescription: character.physicalDescription ?? '',
          standardClothing: character.standardClothing ?? '',
          distinguishingFeatures: character.distinguishingFeatures ?? undefined,
          consistencyTag: character.consistencyTag ?? '',
          firstMention: {
            sceneId: character.firstMentionSceneId ?? '',
            originalText: character.firstMentionText ?? '',
            lineNumber: character.firstMentionLine ?? 0,
          },
        },
        isDefault: true,
        source: 'script_analysis',
      });
    }

    return newTalent;
  });
