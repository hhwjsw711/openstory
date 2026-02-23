import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '#db-client';
import { locationLibrary, locationSheets } from '@/lib/db/schema';
import { authWithTeamMiddleware } from './middleware';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { requireTeamManagement } from '@/lib/db/helpers/team-permissions';
import {
  STORAGE_BUCKETS,
  getMimeTypeFromExtension,
  getExtensionFromUrl,
  getPublicUrl,
  moveFile,
  uploadFile,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { LibraryLocationSheetWorkflowInput } from '@/lib/workflow/types';
import {
  createLibraryLocation,
  updateLibraryLocation,
  deleteLibraryLocation,
  getLibraryLocationById,
  getTeamLibraryLocations,
} from '@/lib/db/helpers/location-library';

type ProcessedImage = { url: string; path: string };

/**
 * Move temp-uploaded images to permanent storage, returning only
 * successfully moved images.
 */
async function processReferenceImages(
  tempUrls: string[],
  teamId: string
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  for (const tempUrl of tempUrls) {
    const tempPathMatch = tempUrl.match(/\/locations\/(.+)$/);
    if (!tempPathMatch) continue;

    const ext = getExtensionFromUrl(tempUrl);
    const permanentPath = `${teamId}/library/${generateId()}.${ext}`;

    await moveFile(STORAGE_BUCKETS.LOCATIONS, tempPathMatch[1], permanentPath);
    const url = getPublicUrl(STORAGE_BUCKETS.LOCATIONS, permanentPath);
    results.push({ url, path: permanentPath });
  }

  return results;
}

/**
 * Verify a location exists and belongs to the given team. Throws if not found.
 */
async function requireLocation(locationId: string, teamId: string) {
  const location = await getLibraryLocationById(locationId);
  if (!location || location.teamId !== teamId) {
    throw new Error('Location not found');
  }
  return location;
}

export const getTeamLibraryLocationsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    return getTeamLibraryLocations(context.teamId);
  });

export const getLibraryLocationByIdFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ locationId: ulidSchema })))
  .handler(async ({ context, data }) => {
    const location = await requireLocation(data.locationId, context.teamId);

    const sheets = await getDb()
      .select()
      .from(locationSheets)
      .where(eq(locationSheets.locationId, data.locationId));

    return {
      ...location,
      sequenceTitle: 'Library' as const,
      sheets,
    };
  });

export const createLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        referenceImageUrls: z.array(z.string().url()).optional(),
      })
    )
  )
  .handler(async ({ context, data }) => {
    const processedImages = await processReferenceImages(
      data.referenceImageUrls ?? [],
      context.teamId
    );

    const mainImage = processedImages[0];

    const newLocation = await createLibraryLocation({
      teamId: context.teamId,
      name: data.name,
      description: data.description,
      referenceImageUrl: mainImage?.url,
      referenceImagePath: mainImage?.path,
      createdBy: context.user.id,
    });

    if (processedImages.length > 0) {
      await getDb()
        .insert(locationSheets)
        .values(
          processedImages.map((img, index) => ({
            locationId: newLocation.id,
            name: `Reference ${index + 1}`,
            imageUrl: img.url,
            imagePath: img.path,
            isDefault: index === 0,
            source: 'manual_upload' as const,
          }))
        );

      const workflowInput: LibraryLocationSheetWorkflowInput = {
        locationDbId: newLocation.id,
        locationName: data.name,
        locationDescription: data.description,
        referenceImageUrls: processedImages.map((img) => img.url),
        teamId: context.teamId,
        sequenceId: 'library',
      };

      await triggerWorkflow('/library-location-sheet', workflowInput);
    }

    return { ...newLocation, sequenceTitle: 'Library' as const };
  });

export const updateLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        locationId: ulidSchema,
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        referenceImageUrl: z.string().url().optional(),
      })
    )
  )
  .handler(async ({ context, data }) => {
    await requireLocation(data.locationId, context.teamId);
    const { locationId, ...updateData } = data;
    return updateLibraryLocation(locationId, updateData);
  });

export const deleteLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ locationId: ulidSchema })))
  .handler(async ({ context, data }) => {
    await requireLocation(data.locationId, context.teamId);
    await requireTeamManagement(context.user.id, context.teamId);
    await deleteLibraryLocation(data.locationId);
    return { success: true };
  });

export const uploadLocationMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        base64Data: z.string(),
        filename: z.string(),
        locationId: ulidSchema.optional(),
      })
    )
  )
  .handler(async ({ context, data }) => {
    const base64Content = data.base64Data.split(',')[1] ?? data.base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const blob = new Blob([buffer]);

    const ext = getExtensionFromUrl(data.filename);
    const uploadId = generateId();

    if (data.locationId) {
      await requireLocation(data.locationId, context.teamId);
    }

    const storagePath = data.locationId
      ? `${context.teamId}/library/${uploadId}.${ext}`
      : `${context.teamId}/temp/${uploadId}.${ext}`;

    const result = await uploadFile(
      STORAGE_BUCKETS.LOCATIONS,
      storagePath,
      blob,
      { contentType: getMimeTypeFromExtension(ext) }
    );

    if (data.locationId) {
      await updateLibraryLocation(data.locationId, {
        referenceImageUrl: result.publicUrl,
        referenceImagePath: result.path,
      });
    }

    return { url: result.publicUrl, path: result.path };
  });

export const addLocationSheetsFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        locationId: ulidSchema,
        imageUrls: z.array(z.string().url()).min(1),
      })
    )
  )
  .handler(async ({ context, data }) => {
    const location = await requireLocation(data.locationId, context.teamId);

    const processedImages = await processReferenceImages(
      data.imageUrls,
      context.teamId
    );

    if (processedImages.length === 0) {
      return { sheets: [] };
    }

    const existingSheets = await getDb()
      .select()
      .from(locationSheets)
      .where(eq(locationSheets.locationId, data.locationId));

    const hasExistingSheets = existingSheets.length > 0;

    // If no sheets exist but location has a reference image, backfill it as a sheet
    if (!hasExistingSheets && location.referenceImageUrl) {
      await getDb()
        .insert(locationSheets)
        .values({
          locationId: data.locationId,
          name: 'Reference 1',
          imageUrl: location.referenceImageUrl,
          imagePath: location.referenceImagePath,
          isDefault: true,
          source: 'manual_upload' as const,
        });
    }

    const newSheets = await getDb()
      .insert(locationSheets)
      .values(
        processedImages.map((img, index) => ({
          locationId: data.locationId,
          name: `Reference ${existingSheets.length + index + 1}`,
          imageUrl: img.url,
          imagePath: img.path,
          isDefault:
            !hasExistingSheets && !location.referenceImageUrl && index === 0,
          source: 'manual_upload' as const,
        }))
      )
      .returning();

    // Collect all reference URLs for the sheet generation workflow
    let existingUrls: string[];
    if (hasExistingSheets) {
      existingUrls = existingSheets
        .map((s) => s.imageUrl)
        .filter((url): url is string => url !== null);
    } else if (location.referenceImageUrl) {
      existingUrls = [location.referenceImageUrl];
    } else {
      existingUrls = [];
    }

    const workflowInput: LibraryLocationSheetWorkflowInput = {
      locationDbId: data.locationId,
      locationName: location.name,
      locationDescription: location.description ?? undefined,
      referenceImageUrls: [
        ...existingUrls,
        ...processedImages.map((img) => img.url),
      ],
      teamId: context.teamId,
      sequenceId: 'library',
    };

    const workflowRunId = await triggerWorkflow(
      '/library-location-sheet',
      workflowInput
    );

    return { sheets: newSheets, workflowRunId };
  });

export const deleteLocationSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ sheetId: ulidSchema })))
  .handler(async ({ context, data }) => {
    const result = await getDb()
      .select({
        sheet: locationSheets,
        location: locationLibrary,
      })
      .from(locationSheets)
      .innerJoin(
        locationLibrary,
        eq(locationSheets.locationId, locationLibrary.id)
      )
      .where(eq(locationSheets.id, data.sheetId));

    const record = result[0];
    if (!record || record.location.teamId !== context.teamId) {
      throw new Error('Sheet not found');
    }

    const { sheet, location } = record;

    await getDb()
      .delete(locationSheets)
      .where(eq(locationSheets.id, data.sheetId));

    // If deleted sheet was default, promote the next available sheet
    if (sheet.isDefault) {
      const [nextSheet] = await getDb()
        .select()
        .from(locationSheets)
        .where(eq(locationSheets.locationId, location.id))
        .limit(1);

      if (nextSheet) {
        await getDb()
          .update(locationSheets)
          .set({ isDefault: true })
          .where(eq(locationSheets.id, nextSheet.id));

        if (nextSheet.imageUrl) {
          await updateLibraryLocation(location.id, {
            referenceImageUrl: nextSheet.imageUrl,
            referenceImagePath: nextSheet.imagePath,
          });
        }
      } else {
        await updateLibraryLocation(location.id, {
          referenceImageUrl: null,
          referenceImagePath: null,
        });
      }
    }

    return { success: true };
  });
