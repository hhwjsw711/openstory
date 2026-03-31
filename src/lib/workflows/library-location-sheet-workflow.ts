/**
 * Library Location Sheet Generation Workflow
 *
 * Generates a 3x3 grid reference sheet for library locations based on
 * user-uploaded reference images. The generated sheet is stored and used
 * as the main reference for the location.
 */

import { uploadResponse } from '@/lib/storage/upload-response';
import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  deductWorkflowCredits,
  extractImageCost,
} from '@/lib/billing/workflow-deduction';
import { generateId } from '@/lib/db/id';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { buildLibraryLocationSheetPrompt } from '@/lib/prompts/location-prompt';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  LibraryLocationSheetWorkflowInput,
  LibraryLocationSheetWorkflowResult,
} from '@/lib/workflow/types';

export const libraryLocationSheetWorkflow = createScopedWorkflow<
  LibraryLocationSheetWorkflowInput,
  LibraryLocationSheetWorkflowResult
>(
  async (context, scopedDb) => {
    const input = context.requestPayload;

    // Step 1: Build the prompt
    const generationParams: ImageGenerationParams = await context.run(
      'build-prompt',
      async () => {
        console.log(
          '[LibraryLocationSheetWorkflow]',
          `Starting sheet generation for location ${input.locationName} with ${input.referenceImageUrls.length} reference images`
        );

        const { prompt, referenceUrls } = buildLibraryLocationSheetPrompt(
          input.locationName,
          input.locationDescription,
          input.referenceImageUrls
        );

        const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

        return {
          model,
          prompt,
          // 3x3 grid in landscape format
          imageSize: 'landscape_16_9' as const,
          numImages: 1,
          referenceImageUrls:
            referenceUrls.length > 0 ? referenceUrls : undefined,
          traceName: 'library-location-sheet',
        } satisfies ImageGenerationParams;
      }
    );

    // Step 2: Generate the location sheet image
    const imageResult = await context.run('generate-sheet-image', async () => {
      console.log(
        '[LibraryLocationSheetWorkflow]',
        `Generating 3x3 grid sheet for ${input.locationName} with model ${generationParams.model}`
      );

      return await generateImageWithProvider(generationParams, { scopedDb });
    });

    // Deduct credits for image generation (skip if team used own fal key)
    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        scopedDb,
        costMicros: extractImageCost(imageResult.metadata),
        usedOwnKey: imageResult.metadata.usedOwnKey,
        description: `Library location sheet (${generationParams.model})`,
        metadata: {
          model: generationParams.model,
          locationName: input.locationName,
          locationDbId: input.locationDbId,
        },
        workflowName: 'LibraryLocationSheetWorkflow',
      });
    });

    // Step 3: Upload to R2 storage
    const storageResult = await context.run('upload-to-storage', async () => {
      const imageUrl = imageResult.imageUrls[0];
      if (!imageUrl) {
        throw new Error('No image URL returned from generation');
      }

      console.log(
        '[LibraryLocationSheetWorkflow]',
        `Uploading sheet to storage for ${input.locationName}`
      );

      // Fetch and stream directly to R2
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated image: ${response.status}`);
      }

      // Build storage path: locations/{teamId}/{sequenceId}/{locationDbId}/sheet_{uniqueId}.png
      const uniqueId = generateId();
      const storagePath = `${input.teamId}/${input.sequenceId}/${input.locationDbId}/sheet_${uniqueId}.png`;

      const result = await uploadResponse(
        response,
        STORAGE_BUCKETS.LOCATIONS,
        storagePath,
        {
          contentType: 'image/png',
        }
      );

      return {
        url: result.publicUrl,
        path: result.path,
      };
    });

    // Step 4: Update database with the generated sheet
    await context.run('update-database', async () => {
      console.log(
        '[LibraryLocationSheetWorkflow]',
        `Updating database for ${input.locationName}`
      );

      await scopedDb.locations.updateReference(
        input.locationDbId,
        storageResult.url,
        storageResult.path
      );
    });

    console.log(
      '[LibraryLocationSheetWorkflow]',
      `Library location sheet workflow completed for ${input.locationName}`
    );

    const result: LibraryLocationSheetWorkflowResult = {
      sheetImageUrl: storageResult.url,
      sheetImagePath: storageResult.path,
      locationDbId: input.locationDbId,
    };

    return result;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;
      const error = sanitizeFailResponse(failResponse);

      console.error(
        '[LibraryLocationSheetWorkflow]',
        `Sheet generation failed for location ${input.locationName}: ${error}`
      );

      return `Library location sheet generation failed for ${input.locationName}`;
    },
  }
);
