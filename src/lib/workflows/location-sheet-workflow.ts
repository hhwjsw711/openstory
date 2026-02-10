/**
 * Location Sheet Generation Workflow
 *
 * Generates location reference images (establishing shots) for visual consistency.
 * These images are later used as reference images when generating scene images.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  updateLocationReference,
  updateReferenceStatus,
} from '@/lib/db/helpers/sequence-locations';
import { generateId } from '@/lib/db/id';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import { buildLocationSheetPrompt } from '@/lib/prompts/location-prompt';
import type {
  LocationSheetWorkflowInput,
  LocationSheetWorkflowResult,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const locationSheetWorkflow = createWorkflow(
  async (context: WorkflowContext<LocationSheetWorkflowInput>) => {
    const input = context.requestPayload;

    // Emit realtime event that generation has started
    await context.run('emit-start-event', async () => {
      if (input.sequenceId && input.locationDbId) {
        await getGenerationChannel(input.sequenceId).emit(
          'generation.location-sheet:progress',
          {
            locationId: input.locationDbId,
            status: 'generating',
          }
        );
      }
    });

    // Step 1: Validate and build prompt
    const generationParams: ImageGenerationParams = await context.run(
      'build-prompt',
      async () => {
        if (!input.locationMetadata) {
          throw new WorkflowValidationError('locationMetadata is required');
        }

        const hasLibraryLocation = !!(
          input.referenceImageUrl || input.libraryLocationDescription
        );
        console.log(
          '[LocationSheetWorkflow]',
          `Starting reference generation for location ${input.locationName}${hasLibraryLocation ? ' with library location reference' : ''}`
        );

        // Build library location overrides if data is provided
        const libraryOverrides = hasLibraryLocation
          ? {
              description: input.libraryLocationDescription,
              referenceImageUrl: input.referenceImageUrl,
            }
          : undefined;

        // Build prompt with location identity + library reference
        const { prompt, referenceUrls } = buildLocationSheetPrompt(
          input.locationMetadata,
          libraryOverrides
        );
        const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

        return {
          model,
          prompt,
          // Location reference images use landscape aspect ratio for establishing shots
          imageSize: 'landscape_16_9' as const,
          numImages: 1,
          // Use library reference image(s) for visual consistency
          referenceImageUrls:
            referenceUrls.length > 0 ? referenceUrls : undefined,
          traceName: 'location-sheet-image',
        };
      }
    );

    // Resolve team API keys (user-provided or platform fallback)
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

    // Step 2: Generate the location reference image
    const imageResult = await context.run(
      'generate-reference-image',
      async () => {
        console.log(
          '[LocationSheetWorkflow]',
          `Generating reference for ${input.locationName} with model ${generationParams.model}`
        );

        return await generateImageWithProvider({
          ...generationParams,
          falApiKey: apiKeys.falApiKey,
        });
      }
    );

    // Deduct credits for image generation (skip if team used own fal key)
    const locSheetCost =
      typeof imageResult.metadata.cost === 'number'
        ? imageResult.metadata.cost
        : 0;
    const lsTeamId = input.teamId;
    if (locSheetCost > 0 && lsTeamId && !apiKeys.falApiKey) {
      await context.run('deduct-credits', async () => {
        const canAfford = await hasEnoughCredits(lsTeamId, locSheetCost);
        if (!canAfford) {
          console.warn(
            `[LocationSheetWorkflow] Insufficient credits for team ${lsTeamId} (cost: $${locSheetCost.toFixed(4)}), skipping deduction`
          );
          return;
        }
        await deductCredits(lsTeamId, locSheetCost, {
          userId: input.userId ?? null,
          description: `Location sheet (${generationParams.model})`,
          metadata: {
            model: generationParams.model,
            locationName: input.locationName,
            locationDbId: input.locationDbId,
          },
        });
      });
    }

    let referenceImageUrl = imageResult.imageUrls[0];
    let referenceImagePath: string | undefined = undefined;

    if (input.locationDbId && input.teamId && input.sequenceId) {
      // Step 3: Upload to R2 storage
      const storageResult = await context.run('upload-to-storage', async () => {
        const imageUrl = imageResult.imageUrls[0];
        if (!imageUrl) {
          throw new Error('No image URL returned from generation');
        }

        console.log(
          '[LocationSheetWorkflow]',
          `Uploading reference to storage for ${input.locationName}`
        );

        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch generated image: ${response.status}`
          );
        }
        const imageBlob = await response.blob();

        // Build storage path: locations/{teamId}/{sequenceId}/{locationDbId}/{uniqueId}.png
        const uniqueId = generateId();
        const storagePath = `${input.teamId}/${input.sequenceId}/${input.locationDbId}/${uniqueId}.png`;

        const result = await uploadFile(
          STORAGE_BUCKETS.LOCATIONS,
          storagePath,
          imageBlob,
          {
            contentType: 'image/png',
          }
        );

        return {
          url: result.publicUrl,
          path: result.path,
        };
      });

      // Step 4: Update database with completed reference
      await context.run('update-database', async () => {
        console.log(
          '[LocationSheetWorkflow]',
          `Updating database for ${input.locationName}`
        );

        await updateLocationReference(
          input.locationDbId,
          storageResult.url,
          storageResult.path
        );
      });

      referenceImagePath = storageResult.path;
      referenceImageUrl = storageResult.url;
    }

    // Emit realtime event that generation is complete
    await context.run('emit-complete-event', async () => {
      if (input.sequenceId && input.locationDbId) {
        await getGenerationChannel(input.sequenceId).emit(
          'generation.location-sheet:progress',
          {
            locationId: input.locationDbId,
            status: 'completed',
            referenceImageUrl,
          }
        );
      }
    });

    console.log(
      '[LocationSheetWorkflow]',
      `Location reference workflow completed for ${input.locationName}`
    );

    const result: LocationSheetWorkflowResult = {
      referenceImageUrl,
      referenceImagePath,
      locationDbId: input.locationDbId,
    };

    return result;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Mark location reference as failed
      if (input.locationDbId) {
        await updateReferenceStatus(
          input.locationDbId,
          'failed',
          String(failResponse)
        );

        // Emit failure event for realtime UI update
        if (input.sequenceId) {
          await getGenerationChannel(input.sequenceId).emit(
            'generation.location-sheet:progress',
            {
              locationId: input.locationDbId,
              status: 'failed',
              error: String(failResponse),
            }
          );
        }

        console.error(
          '[LocationSheetWorkflow]',
          `Reference generation failed for location ${input.locationName}: ${failResponse}`
        );
      }

      return `Location reference generation failed for ${input.locationName}`;
    },
  }
);
