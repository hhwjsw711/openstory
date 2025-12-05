/**
 * Character Sheet Generation Workflow
 *
 * Generates character reference sheets (full body turnaround) for visual consistency.
 * These sheets are later used as reference images when generating scene images.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  setSheetWorkflowRunId,
  updateCharacterSheet,
  updateSheetStatus,
} from '@/lib/db/helpers/sequence-characters';
import {
  generateImageWithProvider,
  ImageGenerationParams,
} from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import type {
  CharacterSheetWorkflowInput,
  CharacterSheetWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';

export const maxDuration = 800;

export const characterSheetWorkflow = createWorkflow(
  async (context: WorkflowContext<CharacterSheetWorkflowInput>) => {
    const input = context.requestPayload;

    // Step 1: Validate and set generating status
    const generationParams: ImageGenerationParams = await context.run(
      'set-generating-status',
      async () => {
        if (!input.characterDbId) {
          throw new WorkflowValidationError('characterDbId is required');
        }
        if (!input.sheetPrompt) {
          throw new WorkflowValidationError('sheetPrompt is required');
        }
        if (!input.sequenceId || !input.teamId) {
          throw new WorkflowValidationError(
            'sequenceId and teamId are required'
          );
        }

        console.log(
          '[CharacterSheetWorkflow]',
          `Starting sheet generation for character ${input.characterName} (${input.characterDbId})`
        );

        // Update status and store workflow run ID
        await setSheetWorkflowRunId(input.characterDbId, context.workflowRunId);

        const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

        return {
          model,
          prompt: input.sheetPrompt,
          // Character sheets use square aspect ratio for turnaround views
          imageSize: 'square_hd' as const,
          numImages: 1,
        };
      }
    );

    // Step 2: Generate the character sheet image
    const imageResult = await context.run('generate-sheet-image', async () => {
      console.log(
        '[CharacterSheetWorkflow]',
        `Generating sheet for ${input.characterName} with model ${generationParams.model}`
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
        '[CharacterSheetWorkflow]',
        `Uploading sheet to storage for ${input.characterName}`
      );

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated image: ${response.status}`);
      }
      const imageBlob = await response.blob();

      // Build storage path: characters/{teamId}/{sequenceId}/{characterDbId}.png
      const storagePath = `${input.teamId}/${input.sequenceId}/${input.characterDbId}.png`;

      const result = await uploadFile(
        STORAGE_BUCKETS.CHARACTERS,
        storagePath,
        imageBlob,
        { contentType: 'image/png' }
      );

      return {
        url: result.publicUrl,
        path: result.path,
      };
    });

    // Step 4: Update database with completed sheet
    await context.run('update-database', async () => {
      console.log(
        '[CharacterSheetWorkflow]',
        `Updating database for ${input.characterName}`
      );

      await updateCharacterSheet(
        input.characterDbId,
        storageResult.url,
        storageResult.path
      );
    });

    console.log(
      '[CharacterSheetWorkflow]',
      `Character sheet workflow completed for ${input.characterName}`
    );

    const result: CharacterSheetWorkflowResult = {
      characterDbId: input.characterDbId,
      sheetImageUrl: storageResult.url,
      sheetImagePath: storageResult.path,
    };

    return result;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Mark character sheet as failed
      if (input.characterDbId) {
        await updateSheetStatus(
          input.characterDbId,
          'failed',
          String(failResponse)
        );

        console.error(
          '[CharacterSheetWorkflow]',
          `Sheet generation failed for character ${input.characterName}: ${failResponse}`
        );
      }

      return `Character sheet generation failed for ${input.characterName}`;
    },
  }
);
