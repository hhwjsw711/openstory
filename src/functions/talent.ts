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
  createTalentMediaRecord,
  createTalentSheet,
  deleteTalent,
  deleteTalentMediaRecord,
  deleteTalentSheet,
  getTalentById,
  getTalentSheetById,
  getTalentWithRelations,
  updateTalentSheet,
} from '@/lib/db/helpers/talent';
import { requireTeamManagement } from '@/lib/db/helpers/team-permissions';
import {
  STORAGE_BUCKETS,
  getPathFromUrl,
  getPublicUrl,
} from '@/lib/storage/buckets';
import { deleteFile, moveFile, uploadFile } from '#storage';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { generateId } from '@/lib/db/id';
import type { LibraryTalentSheetWorkflowInput } from '@/lib/workflow/types';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { Talent, TalentWithSheets } from '@/lib/db/schema';

const talentIdSchema = z.object({ talentId: ulidSchema });
const sheetIdSchema = z.object({ sheetId: ulidSchema });
const mediaIdSchema = z.object({ mediaId: ulidSchema });
const characterIdSchema = z.object({ characterId: ulidSchema });

/**
 * Verify a talent record belongs to the given team, throwing if not found.
 */
async function requireTalentOwnership(
  talentId: string,
  teamId: string
): Promise<Talent> {
  const record = await getTalentById(talentId);
  if (!record || record.teamId !== teamId) {
    throw new Error('Talent not found');
  }
  return record;
}

/**
 * Decode a base64 data URL or raw base64 string into a Blob.
 */
function decodeBase64ToBlob(base64Data: string): Blob {
  const raw = base64Data.split(',')[1] ?? base64Data;
  return new Blob([Buffer.from(raw, 'base64')]);
}

// List Talent

export const getTalentFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(listTalentFilterSchema.optional()))
  .handler(async ({ context, data }): Promise<TalentWithSheets[]> => {
    return context.scopedDb.talent.list({
      favoritesOnly: data?.favoritesOnly,
    });
  });

// Get Single Talent

export const getTalentByIdFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(talentIdSchema))
  .handler(async ({ context, data }) => {
    const talentRecord = await getTalentWithRelations(data.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    return talentRecord;
  });

// Create Talent

export const createTalentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createTalentSchema))
  .handler(async ({ context, data }) => {
    const newTalent = await context.scopedDb.talent.create({
      name: data.name,
      description: data.description,
      isFavorite: data.isFavorite ?? false,
      isHuman: data.isHuman ?? false,
      createdBy: context.user.id,
    });

    // Move temp files to permanent location and create media records
    const tempUrls = data.referenceImageUrls ?? [];
    const permanentUrls: string[] = [];

    for (const tempUrl of tempUrls) {
      const tempPath = getPathFromUrl(tempUrl, STORAGE_BUCKETS.TALENT);
      const ext = getExtensionFromUrl(tempUrl);
      const mediaId = generateId();
      const permanentPath = `${context.teamId}/${newTalent.id}/${mediaId}.${ext}`;

      await moveFile(STORAGE_BUCKETS.TALENT, tempPath, permanentPath);

      const permanentUrl = getPublicUrl(STORAGE_BUCKETS.TALENT, permanentPath);
      permanentUrls.push(permanentUrl);

      await createTalentMediaRecord({
        talentId: newTalent.id,
        type: 'image',
        url: permanentUrl,
        path: permanentPath,
      });
    }

    // Trigger talent sheet generation workflow asynchronously
    const workflowInput: LibraryTalentSheetWorkflowInput = {
      userId: context.user.id,
      teamId: context.teamId,
      talentId: newTalent.id,
      talentName: newTalent.name,
      talentDescription: newTalent.description ?? undefined,
      referenceImageUrls: permanentUrls,
      sheetName: 'Default Sheet',
    };

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

// Update Talent

const updateTalentInputSchema = updateTalentSchema.extend({
  talentId: ulidSchema,
});

export const updateTalentFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(updateTalentInputSchema))
  .handler(async ({ context, data }) => {
    const { talentId, ...updateData } = data;

    const updated = await context.scopedDb.talent.update(talentId, updateData);

    if (!updated) {
      throw new Error('Talent not found or you do not have permission');
    }

    return updated;
  });

// Delete Talent (requires admin/owner role)

export const deleteTalentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(talentIdSchema))
  .handler(async ({ context, data }) => {
    const talentRecord = await getTalentById(data.talentId);
    if (!talentRecord) {
      throw new Error('Talent not found');
    }

    await requireTeamManagement(context.user.id, talentRecord.teamId);

    const deleted = await deleteTalent(data.talentId, talentRecord.teamId);
    if (!deleted) {
      throw new Error('Failed to delete talent');
    }

    return { success: true };
  });

// Toggle Favorite

export const toggleTalentFavoriteFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(talentIdSchema))
  .handler(async ({ context, data }) => {
    const updated = await context.scopedDb.talent.toggleFavorite(data.talentId);

    if (!updated) {
      throw new Error('Talent not found or you do not have permission');
    }

    return updated;
  });

// Create Talent Sheet

export const createTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createTalentSheetSchema))
  .handler(async ({ context, data }) => {
    await requireTalentOwnership(data.talentId, context.teamId);

    return createTalentSheet({
      talentId: data.talentId,
      name: data.name,
      imageUrl: data.imageUrl,
      imagePath: data.imagePath,
      metadata: data.metadata,
      isDefault: data.isDefault ?? false,
      source:
        data.source === 'ai_generated' ||
        data.source === 'manual_upload' ||
        data.source === 'script_analysis'
          ? data.source
          : 'manual_upload',
    });
  });

// Delete Talent Sheet

export const deleteTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(sheetIdSchema))
  .handler(async ({ context, data }) => {
    const sheet = await getTalentSheetById(data.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found');
    }

    await requireTalentOwnership(sheet.talentId, context.teamId);

    const deleted = await deleteTalentSheet(data.sheetId);
    if (!deleted) {
      throw new Error('Failed to delete sheet');
    }

    return { success: true };
  });

// Set Default Sheet

export const setDefaultSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(sheetIdSchema))
  .handler(async ({ context, data }) => {
    const sheet = await getTalentSheetById(data.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found');
    }

    await requireTalentOwnership(sheet.talentId, context.teamId);

    const updated = await updateTalentSheet(data.sheetId, { isDefault: true });
    if (!updated) {
      throw new Error('Failed to update sheet');
    }

    return updated;
  });

// Upload Talent Media

const uploadMediaInputSchema = z.object({
  talentId: ulidSchema,
  type: z.enum(['image', 'video', 'recording']),
  base64Data: z.string(),
  filename: z.string(),
});

export const uploadTalentMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(uploadMediaInputSchema))
  .handler(async ({ context, data }) => {
    await requireTalentOwnership(data.talentId, context.teamId);

    const blob = decodeBase64ToBlob(data.base64Data);
    const ext = getExtensionFromUrl(data.filename);
    const mediaId = generateId();
    const storagePath = `${context.teamId}/${data.talentId}/${mediaId}.${ext}`;

    const result = await uploadFile(STORAGE_BUCKETS.TALENT, storagePath, blob, {
      contentType: getMimeTypeFromExtension(ext),
    });

    return createTalentMediaRecord({
      id: mediaId,
      talentId: data.talentId,
      type: data.type,
      url: result.publicUrl,
      path: result.path,
    });
  });

// Upload Temp Media (before talent creation)

const uploadTempMediaInputSchema = z.object({
  base64Data: z.string(),
  filename: z.string(),
  type: z.enum(['image', 'video']),
});

export const uploadTempMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(uploadTempMediaInputSchema))
  .handler(async ({ context, data }) => {
    const blob = decodeBase64ToBlob(data.base64Data);
    const ext = getExtensionFromUrl(data.filename);
    const uploadId = generateId();
    const storagePath = `${context.teamId}/temp/${uploadId}.${ext}`;

    const result = await uploadFile(STORAGE_BUCKETS.TALENT, storagePath, blob, {
      contentType: getMimeTypeFromExtension(ext),
    });

    return { url: result.publicUrl, path: result.path };
  });

// Delete Talent Media

export const deleteTalentMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(mediaIdSchema))
  .handler(async ({ context, data }) => {
    const { getDb } = await import('#db-client');
    const { talentMedia } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const media = await getDb().query.talentMedia.findFirst({
      where: eq(talentMedia.id, data.mediaId),
    });

    if (!media) {
      throw new Error('Media not found');
    }

    await requireTalentOwnership(media.talentId, context.teamId);

    if (media.path) {
      try {
        await deleteFile(
          STORAGE_BUCKETS.TALENT,
          media.path.replace('talent/', '')
        );
      } catch {
        // Storage deletion is best-effort
      }
    }

    const deleted = await deleteTalentMediaRecord(data.mediaId);
    if (!deleted) {
      throw new Error('Failed to delete media');
    }

    return { success: true };
  });

// Generate Talent Sheet

const generateSheetInputSchema = z.object({
  talentId: ulidSchema,
  sheetName: z.string().optional(),
});

export const generateTalentSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(generateSheetInputSchema))
  .handler(async ({ context, data }) => {
    const talentRecord = await getTalentWithRelations(data.talentId);

    if (!talentRecord || talentRecord.teamId !== context.teamId) {
      throw new Error('Talent not found');
    }

    const imageMedia =
      talentRecord.media?.filter((m) => m.type === 'image') ?? [];
    if (imageMedia.length === 0) {
      throw new Error(
        'Talent must have at least one reference image to generate a sheet'
      );
    }

    const workflowInput: LibraryTalentSheetWorkflowInput = {
      userId: context.user.id,
      teamId: context.teamId,
      talentId: talentRecord.id,
      talentName: talentRecord.name,
      talentDescription: talentRecord.description ?? undefined,
      referenceImageUrls: imageMedia.map((m) => m.url),
      sheetName: data.sheetName,
    };

    const runId = await triggerWorkflow('/library-talent-sheet', workflowInput);
    return { runId };
  });

export const addCharacterToLibraryFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(characterIdSchema))
  .handler(async ({ context, data }) => {
    const { getDb } = await import('#db-client');
    const { characters, sequences } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const character = await getDb().query.characters.findFirst({
      where: eq(characters.id, data.characterId),
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const sequence = await getDb().query.sequences.findFirst({
      where: eq(sequences.id, character.sequenceId),
    });

    if (!sequence || sequence.teamId !== context.teamId) {
      throw new Error('Character not found');
    }

    const newTalent = await context.scopedDb.talent.create({
      name: character.name,
      description: character.physicalDescription ?? undefined,
      imageUrl: character.sheetImageUrl ?? undefined,
      imagePath: character.sheetImagePath ?? undefined,
      isFavorite: false,
      isHuman: false,
      isInTeamLibrary: true,
      createdBy: context.user.id,
    });

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
          gender: character.gender ?? '',
          ethnicity: character.ethnicity ?? '',
          physicalDescription: character.physicalDescription ?? '',
          standardClothing: character.standardClothing ?? '',
          distinguishingFeatures: character.distinguishingFeatures ?? '',
          consistencyTag: character.consistencyTag ?? '',
        },
        isDefault: true,
        source: 'script_analysis',
      });
    }

    return newTalent;
  });
