/**
 * Character Sheet Generation Workflow
 *
 * Generates character reference sheets (full body turnaround) for visual consistency.
 * These sheets are later used as reference images when generating scene images.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  updateCharacterSheet,
  updateSheetStatus,
} from '@/lib/db/helpers/sequence-characters';
import {
  generateImageWithProvider,
  ImageGenerationParams,
} from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { buildCharacterSheetPrompt } from '@/lib/services/character.service';
import type {
  CharacterSheetWorkflowInput,
  CharacterSheetWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

const maxDuration = 800;

export const characterSheetWorkflow = createWorkflow(
  async (context: WorkflowContext<CharacterSheetWorkflowInput>) => {
    const input = context.requestPayload;

    // Step 1: Validate and build prompt
    const generationParams: ImageGenerationParams = await context.run(
      'build-prompt',
      async () => {
        if (!input.characterMetadata) {
          throw new WorkflowValidationError('characterMetadata is required');
        }

        console.log(
          '[CharacterSheetWorkflow]',
          `Starting sheet generation for character ${input.characterName}`
        );

        const sheetPrompt = buildCharacterSheetPrompt(input.characterMetadata);
        const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

        return {
          model,
          prompt: sheetPrompt,
          // Character sheets use landscape aspect ratio for multi-panel layout
          imageSize: 'landscape_16_9' as const,
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

    let sheetImageUrl = imageResult.imageUrls[0];
    let sheetImagePath: string | undefined = undefined;

    if (input.characterDbId && input.teamId && input.sequenceId) {
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
          throw new Error(
            `Failed to fetch generated image: ${response.status}`
          );
        }
        const imageBlob = await response.blob();

        // Build storage path: characters/{teamId}/{sequenceId}/{characterDbId}.png
        const storagePath = `${input.teamId}/${input.sequenceId}/${input.characterDbId}.png`;

        const result = await uploadFile(
          STORAGE_BUCKETS.CHARACTERS,
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

      sheetImagePath = storageResult.path;
      sheetImageUrl = storageResult.url;
    }
    console.log(
      '[CharacterSheetWorkflow]',
      `Character sheet workflow completed for ${input.characterName}`
    );

    const result: CharacterSheetWorkflowResult = {
      sheetImageUrl,
      sheetImagePath,
      characterDbId: input.characterDbId,
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
