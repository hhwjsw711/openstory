/**
 * Sequence Locations Server Functions
 * Functions for sequence-specific location operations
 */

import {
  getFrameIdsForLocation,
  getSequenceLocations,
  updateReferenceStatus,
} from '@/lib/db/helpers/sequence-locations';
import { locations as locationsTable } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { RecastLocationWorkflowInput } from '@/lib/workflow/types';
import { getDb } from '#db-client';
import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authWithTeamMiddleware, sequenceAccessMiddleware } from './middleware';

/**
 * Get all locations for a sequence
 * Returns locations extracted from the script with their reference images
 */
export const getSequenceLocationsFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    return getSequenceLocations(context.sequence.id);
  });

// =============================================================================
// Frame-Location Operations
// =============================================================================

const getFrameIdsForLocationInputSchema = z.object({
  locationId: z.string().min(1),
});

/**
 * Get frame IDs for all frames at a specific location
 * Used to show the count of affected frames before recasting
 */
export const getFrameIdsForLocationFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(getFrameIdsForLocationInputSchema))
  .handler(async ({ context, data }) => {
    const frameIds = await getFrameIdsForLocation(
      context.sequence.id,
      data.locationId
    );
    return { frameIds, count: frameIds.length };
  });

// =============================================================================
// Recast Operations
// =============================================================================

const recastLocationInputSchema = z.object({
  locationId: z.string().min(1),
  libraryLocationId: z.string().min(1),
  referenceImageUrl: z.string().url(),
  description: z.string().optional(),
});

/**
 * Recast a location with a library location reference
 * This triggers location reference regeneration and frame regeneration
 */
export const recastLocationFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(recastLocationInputSchema))
  .handler(async ({ context, data }) => {
    // Get the location
    const [location] = await getDb()
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, data.locationId));

    if (!location) {
      throw new Error('Location not found');
    }

    // Set reference status to generating
    await updateReferenceStatus(data.locationId, 'generating');

    // Emit immediate realtime event so UI shows generating state instantly
    await getGenerationChannel(location.sequenceId).emit(
      'generation.location-sheet:progress',
      {
        locationId: data.locationId,
        status: 'generating',
      }
    );

    // Get affected frame IDs BEFORE triggering workflow (needed for chained regeneration)
    const affectedFrameIds = await getFrameIdsForLocation(
      location.sequenceId,
      data.locationId
    );

    // Build location metadata from the existing location
    const locationMetadata = {
      locationId: location.locationId,
      name: location.name,
      type: (location.type as 'interior' | 'exterior' | 'both') ?? 'interior',
      timeOfDay: location.timeOfDay ?? '',
      description: location.description ?? '',
      architecturalStyle: location.architecturalStyle ?? '',
      keyFeatures: location.keyFeatures ?? '',
      colorPalette: location.colorPalette ?? '',
      lightingSetup: location.lightingSetup ?? '',
      ambiance: location.ambiance ?? '',
      consistencyTag: location.consistencyTag ?? '',
      firstMention: {
        sceneId: location.firstMentionSceneId ?? '',
        text: location.firstMentionText ?? '',
        lineNumber: location.firstMentionLine ?? 0,
      },
    };

    // Trigger recast workflow which orchestrates reference generation + frame regeneration
    const workflowInput: RecastLocationWorkflowInput = {
      locationDbId: data.locationId,
      locationName: location.name,
      locationMetadata,
      sequenceId: location.sequenceId,
      teamId: context.teamId,
      userId: context.user.id,
      referenceImageUrl: data.referenceImageUrl,
      libraryLocationDescription: data.description,
      affectedFrameIds,
    };

    const workflowRunId = await triggerWorkflow(
      '/recast-location',
      workflowInput
    );

    return {
      locationId: data.locationId,
      referenceWorkflowRunId: workflowRunId,
      affectedFrameIds,
    };
  });
