/**
 * Location Library Server Functions
 * Functions for team-level location library operations
 */

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
} from '@/lib/db/helpers/location-library';

// ============================================================================
// Get Location By ID
// ============================================================================

const getLocationInputSchema = z.object({
  locationId: ulidSchema,
});

/**
 * Get a single library location with reference sheets
 */
export const getLibraryLocationByIdFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(getLocationInputSchema))
  .handler(async ({ context, data }) => {
    const location = await getLibraryLocationById(data.locationId);

    if (!location || location.teamId !== context.teamId) {
      throw new Error('Location not found');
    }

    // Get all reference sheets for this location
    const sheets = await getDb()
      .select()
      .from(locationSheets)
      .where(eq(locationSheets.locationId, data.locationId));

    return {
      ...location,
      sequenceTitle: 'Library', // For backwards compatibility with UI
      sheets,
    };
  });

// ============================================================================
// Create Library Location
// ============================================================================

const createLocationInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
});

/**
 * Create a new location in the team library
 */
export const createLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createLocationInputSchema))
  .handler(async ({ context, data }) => {
    // Process reference images - move from temp and track for location_sheets
    const processedImages: { url: string; path: string }[] = [];
    const referenceImageUrls = data.referenceImageUrls ?? [];

    for (const tempUrl of referenceImageUrls) {
      const ext = getExtensionFromUrl(tempUrl);
      const imageId = generateId();
      const permanentPath = `${context.teamId}/library/${imageId}.${ext}`;

      // Extract temp path from URL
      const tempPathMatch = tempUrl.match(/\/locations\/(.+)$/);
      if (tempPathMatch) {
        const tempPath = tempPathMatch[1];
        await moveFile(STORAGE_BUCKETS.LOCATIONS, tempPath, permanentPath);
        const permanentUrl = getPublicUrl(
          STORAGE_BUCKETS.LOCATIONS,
          permanentPath
        );
        processedImages.push({ url: permanentUrl, path: permanentPath });
      }
    }

    // Use first image as the main reference (for card previews)
    const mainImage = processedImages[0];

    // Create the library location
    const newLocation = await createLibraryLocation({
      teamId: context.teamId,
      name: data.name,
      description: data.description,
      referenceImageUrl: mainImage?.url,
      referenceImagePath: mainImage?.path,
      createdBy: context.user.id,
    });

    // Create location_sheets for each reference image
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

      // Trigger the library location sheet workflow to generate a 3x3 grid
      const workflowInput: LibraryLocationSheetWorkflowInput = {
        locationDbId: newLocation.id,
        locationName: data.name,
        locationDescription: data.description,
        referenceImageUrls: processedImages.map((img) => img.url),
        teamId: context.teamId,
        sequenceId: 'library', // Placeholder for storage path
      };

      await triggerWorkflow('/library-location-sheet', workflowInput);
    }

    return {
      ...newLocation,
      sequenceTitle: 'Library', // For backwards compatibility
    };
  });

// ============================================================================
// Update Library Location
// ============================================================================

const updateLocationInputSchema = z.object({
  locationId: ulidSchema,
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  referenceImageUrl: z.string().url().optional(),
});

/**
 * Update a library location
 */
export const updateLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(updateLocationInputSchema))
  .handler(async ({ context, data }) => {
    const location = await getLibraryLocationById(data.locationId);

    if (!location || location.teamId !== context.teamId) {
      throw new Error('Location not found');
    }

    const { locationId, ...updateData } = data;

    const updated = await updateLibraryLocation(locationId, updateData);

    return updated;
  });

// ============================================================================
// Delete Library Location
// ============================================================================

const deleteLocationInputSchema = z.object({
  locationId: ulidSchema,
});

/**
 * Delete a library location
 */
export const deleteLibraryLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteLocationInputSchema))
  .handler(async ({ context, data }) => {
    const location = await getLibraryLocationById(data.locationId);

    if (!location || location.teamId !== context.teamId) {
      throw new Error('Location not found');
    }

    // Check if user has admin/owner role
    await requireTeamManagement(context.user.id, context.teamId);

    // Delete the location (cascades to sheets)
    await deleteLibraryLocation(data.locationId);

    return { success: true };
  });

// ============================================================================
// Upload Location Media
// ============================================================================

const uploadMediaInputSchema = z.object({
  base64Data: z.string(),
  filename: z.string(),
  locationId: ulidSchema.optional(),
});

/**
 * Upload location reference media
 * If locationId is provided, uploads directly to the location
 * Otherwise, uploads to temp storage for later association
 */
export const uploadLocationMediaFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(uploadMediaInputSchema))
  .handler(async ({ context, data }) => {
    // Decode base64 data
    const base64Content = data.base64Data.split(',')[1] ?? data.base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const blob = new Blob([buffer]);

    const ext = getExtensionFromUrl(data.filename);
    const uploadId = generateId();

    let storagePath: string;

    if (data.locationId) {
      // Get location to verify ownership
      const location = await getLibraryLocationById(data.locationId);

      if (!location || location.teamId !== context.teamId) {
        throw new Error('Location not found');
      }

      storagePath = `${context.teamId}/library/${uploadId}.${ext}`;
    } else {
      // Upload to temp folder
      storagePath = `${context.teamId}/temp/${uploadId}.${ext}`;
    }

    const result = await uploadFile(
      STORAGE_BUCKETS.LOCATIONS,
      storagePath,
      blob,
      {
        contentType: getMimeTypeFromExtension(ext),
      }
    );

    // If locationId provided, update the location's reference image
    if (data.locationId) {
      await updateLibraryLocation(data.locationId, {
        referenceImageUrl: result.publicUrl,
        referenceImagePath: result.path,
      });
    }

    return { url: result.publicUrl, path: result.path };
  });

// ============================================================================
// Add Location Sheet
// ============================================================================

const addSheetInputSchema = z.object({
  locationId: ulidSchema,
  imageUrls: z.array(z.string().url()).min(1),
});

/**
 * Add reference images to an existing library location
 */
export const addLocationSheetsFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(addSheetInputSchema))
  .handler(async ({ context, data }) => {
    const location = await getLibraryLocationById(data.locationId);

    if (!location || location.teamId !== context.teamId) {
      throw new Error('Location not found');
    }

    // Process each image - move from temp and create sheets
    const processedImages: { url: string; path: string }[] = [];

    for (const tempUrl of data.imageUrls) {
      const ext = getExtensionFromUrl(tempUrl);
      const imageId = generateId();
      const permanentPath = `${context.teamId}/library/${imageId}.${ext}`;

      // Extract temp path from URL
      const tempPathMatch = tempUrl.match(/\/locations\/(.+)$/);
      if (tempPathMatch) {
        const tempPath = tempPathMatch[1];
        await moveFile(STORAGE_BUCKETS.LOCATIONS, tempPath, permanentPath);
        const permanentUrl = getPublicUrl(
          STORAGE_BUCKETS.LOCATIONS,
          permanentPath
        );
        processedImages.push({ url: permanentUrl, path: permanentPath });
      }
    }

    // Check if location already has sheets
    const existingSheets = await getDb()
      .select()
      .from(locationSheets)
      .where(eq(locationSheets.locationId, data.locationId));

    let hasExistingSheets = existingSheets.length > 0;

    // If no sheets but location has referenceImageUrl, create a sheet from it first
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
      hasExistingSheets = true;
    }

    // Create location_sheets for each new image
    if (processedImages.length > 0) {
      const newSheets = await getDb()
        .insert(locationSheets)
        .values(
          processedImages.map((img, index) => ({
            locationId: data.locationId,
            name: `Reference ${existingSheets.length + index + 1}`,
            imageUrl: img.url,
            imagePath: img.path,
            isDefault: !hasExistingSheets && index === 0,
            source: 'manual_upload' as const,
          }))
        )
        .returning();

      // Collect all reference image URLs for the workflow
      const allReferenceUrls = [
        ...(hasExistingSheets
          ? existingSheets.filter((s) => s.imageUrl).map((s) => s.imageUrl)
          : location.referenceImageUrl
            ? [location.referenceImageUrl]
            : []),
        ...processedImages.map((img) => img.url),
      ];

      // Trigger the library location sheet workflow to generate a 3x3 grid
      const workflowInput: LibraryLocationSheetWorkflowInput = {
        locationDbId: data.locationId,
        locationName: location.name,
        locationDescription: location.description ?? undefined,
        referenceImageUrls: allReferenceUrls.filter((url) => url !== null),
        teamId: context.teamId,
        sequenceId: 'library', // Placeholder for storage path
      };

      const workflowRunId = await triggerWorkflow(
        '/library-location-sheet',
        workflowInput
      );

      return { sheets: newSheets, workflowRunId };
    }

    return { sheets: [] };
  });

// ============================================================================
// Delete Location Sheet
// ============================================================================

const deleteSheetInputSchema = z.object({
  sheetId: ulidSchema,
});

/**
 * Delete a reference image from a library location
 */
export const deleteLocationSheetFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(deleteSheetInputSchema))
  .handler(async ({ context, data }) => {
    // Get the sheet with location to verify ownership
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

    const wasDefault = record.sheet.isDefault;
    const locationId = record.location.id;

    // Delete the sheet
    await getDb()
      .delete(locationSheets)
      .where(eq(locationSheets.id, data.sheetId));

    // If this was the default sheet, make another one default
    if (wasDefault) {
      const remainingSheets = await getDb()
        .select()
        .from(locationSheets)
        .where(eq(locationSheets.locationId, locationId))
        .limit(1);

      if (remainingSheets[0]) {
        await getDb()
          .update(locationSheets)
          .set({ isDefault: true })
          .where(eq(locationSheets.id, remainingSheets[0].id));

        // Update location's main reference image
        if (remainingSheets[0].imageUrl) {
          await updateLibraryLocation(locationId, {
            referenceImageUrl: remainingSheets[0].imageUrl,
            referenceImagePath: remainingSheets[0].imagePath,
          });
        }
      } else {
        // No more sheets, clear the location's reference image
        await updateLibraryLocation(locationId, {
          referenceImageUrl: null,
          referenceImagePath: null,
        });
      }
    }

    return { success: true };
  });
