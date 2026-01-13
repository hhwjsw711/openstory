/**
 * Library Location Sheet Generation Workflow
 *
 * Generates a 3x3 grid reference sheet for library locations based on
 * user-uploaded reference images. The generated sheet is stored and used
 * as the main reference for the location.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { updateLibraryLocationReference } from '@/lib/db/helpers/location-library';
import { generateId } from '@/lib/db/id';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { buildLibraryLocationSheetPrompt } from '@/lib/prompts/location-prompt';
import type {
  LibraryLocationSheetWorkflowInput,
  LibraryLocationSheetWorkflowResult,
} from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const libraryLocationSheetWorkflow = createWorkflow(
  async (context: WorkflowContext<LibraryLocationSheetWorkflowInput>) => {
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
        };
      }
    );

    // Step 2: Generate the location sheet image
    const imageResult = await context.run('generate-sheet-image', async () => {
      console.log(
        '[LibraryLocationSheetWorkflow]',
        `Generating 3x3 grid sheet for ${input.locationName} with model ${generationParams.model}`
      );

      return await generateImageWithProvider(generationParams);
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

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated image: ${response.status}`);
      }
      const imageBlob = await response.blob();

      // Build storage path: locations/{teamId}/{sequenceId}/{locationDbId}/sheet_{uniqueId}.png
      const uniqueId = generateId();
      const storagePath = `${input.teamId}/${input.sequenceId}/${input.locationDbId}/sheet_${uniqueId}.png`;

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

    // Step 4: Update database with the generated sheet
    await context.run('update-database', async () => {
      console.log(
        '[LibraryLocationSheetWorkflow]',
        `Updating database for ${input.locationName}`
      );

      await updateLibraryLocationReference(
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

      console.error(
        '[LibraryLocationSheetWorkflow]',
        `Sheet generation failed for location ${input.locationName}: ${failResponse}`
      );

      return `Library location sheet generation failed for ${input.locationName}`;
    },
  }
);
