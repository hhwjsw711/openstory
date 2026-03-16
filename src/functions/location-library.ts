import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { authWithTeamMiddleware } from './middleware';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { requireTeamAdminAccess } from '@/lib/auth/action-utils';
import { STORAGE_BUCKETS, getPublicUrl } from '@/lib/storage/buckets';
import { moveFile, uploadFile } from '#storage';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { generateId } from '@/lib/db/id';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { LibraryLocationSheetWorkflowInput } from '@/lib/workflow/types';
import type { LibraryLocation } from '@/lib/db/schema';

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
 * Uses scopedDb which is already team-scoped via getById.
 */
async function requireLocation(
  scopedDb: {
    locations: { getById: (id: string) => Promise<LibraryLocation | null> };
  },
  locationId: string
) {
  const location = await scopedDb.locations.getById(locationId);
  if (!location) {
    throw new Error('Location not found');
  }
  return location;
}

export const getTeamLibraryLocationsFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    return context.scopedDb.locations.list();
  });

export const getLibraryLocationByIdFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ locationId: ulidSchema })))
  .handler(async ({ context, data }) => {
    const location = await requireLocation(context.scopedDb, data.locationId);

    const sheets = await context.scopedDb.locationSheets.list(data.locationId);

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

    const newLocation = await context.scopedDb.locations.create({
      name: data.name,
      description: data.description,
      referenceImageUrl: mainImage?.url,
      referenceImagePath: mainImage?.path,
      createdBy: context.user.id,
    });

    if (processedImages.length > 0) {
      await context.scopedDb.locationSheets.insert(
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
    await requireLocation(context.scopedDb, data.locationId);
    const { locationId, ...updateData } = data;
    return context.scopedDb.locations.update(locationId, updateData);
  });

export const deleteLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ locationId: ulidSchema })))
  .handler(async ({ context, data }) => {
    await requireLocation(context.scopedDb, data.locationId);
    await requireTeamAdminAccess(context.user.id, context.teamId);
    await context.scopedDb.locations.delete(data.locationId);
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
      await requireLocation(context.scopedDb, data.locationId);
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
      await context.scopedDb.locations.update(data.locationId, {
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
    const location = await requireLocation(context.scopedDb, data.locationId);

    const processedImages = await processReferenceImages(
      data.imageUrls,
      context.teamId
    );

    if (processedImages.length === 0) {
      return { sheets: [] };
    }

    const existingSheets = await context.scopedDb.locationSheets.list(
      data.locationId
    );

    const hasExistingSheets = existingSheets.length > 0;

    // If no sheets exist but location has a reference image, backfill it as a sheet
    if (!hasExistingSheets && location.referenceImageUrl) {
      await context.scopedDb.locationSheets.insert([
        {
          locationId: data.locationId,
          name: 'Reference 1',
          imageUrl: location.referenceImageUrl,
          imagePath: location.referenceImagePath,
          isDefault: true,
          source: 'manual_upload' as const,
        },
      ]);
    }

    const newSheets = await context.scopedDb.locationSheets.insert(
      processedImages.map((img, index) => ({
        locationId: data.locationId,
        name: `Reference ${existingSheets.length + index + 1}`,
        imageUrl: img.url,
        imagePath: img.path,
        isDefault:
          !hasExistingSheets && !location.referenceImageUrl && index === 0,
        source: 'manual_upload' as const,
      }))
    );

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
    const record = await context.scopedDb.locationSheets.getWithLocation(
      data.sheetId
    );
    if (!record || record.location.teamId !== context.teamId) {
      throw new Error('Sheet not found');
    }

    const { sheet, location } = record;

    await context.scopedDb.locationSheets.delete(data.sheetId);

    // If deleted sheet was default, promote the next available sheet
    if (sheet.isDefault) {
      await context.scopedDb.locationSheets.promoteDefault(location.id);
    }

    return { success: true };
  });
