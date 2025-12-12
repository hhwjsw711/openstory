/**
 * Character Sheet Generation Workflow
 *
 * Generates character reference sheets (full body turnaround) for visual consistency.
 * These sheets are later used as reference images when generating scene images.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  createSequenceCharacter,
  updateCharacterSheet,
  updateSheetStatus,
} from '@/lib/db/helpers/sequence-characters';
import {
  generateImageWithProvider,
  ImageGenerationParams,
} from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import {
  buildCharacterSheetPrompt,
  createFromBible,
} from '@/lib/services/character.service';
import type {
  CharacterBibleWorkflowInput,
  CharacterSheetWorkflowInput,
  CharacterSheetWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { SequenceCharacter } from '@/lib/db/schema';
import { generateId } from 'better-auth';
import { SequenceCharacterMinimal } from '@/lib/db/schema/sequence-characters';
import { getGenerationChannel } from '@/lib/realtime';

export const maxDuration = 800;

export const characterBibleWorkflow = createWorkflow(
  async (
    context: WorkflowContext<CharacterBibleWorkflowInput>
  ): Promise<SequenceCharacterMinimal[]> => {
    const input = context.requestPayload;

    // Emit Phase 3 start
    await context.run('character-bible-start', async () => {
      await getGenerationChannel(input.sequenceId).emit(
        'generation.phase:start',
        {
          phase: 3,
          phaseName: 'Character Bible',
        }
      );
    });

    const seqCharacters: SequenceCharacterMinimal[] = await Promise.all(
      input.characterBible.map(async (character) => {
        return await context.run('character-sheet', async () => {
          // Build character sheet prompt
          const sheetPrompt = buildCharacterSheetPrompt(character);

          // Generate character sheet image
          const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

          const imageResult = await generateImageWithProvider({
            model,
            prompt: sheetPrompt,
            imageSize: 'landscape_16_9' as const,
            numImages: 1,
            resolution: '2K' as const,
          });

          const imageUrl = imageResult.imageUrls[0];
          if (!imageUrl) {
            throw new Error('No image URL returned from generation');
          }
          // Generate ULID-based filename
          const characterId = generateId();
          // Save to R2 and DB if sequenceId, userId, and teamId are provided
          if (input.sequenceId && input.userId && input.teamId) {
            // Storage path
            const storagePath = `${input.teamId}/${input.sequenceId}/${characterId}.png`;

            // Fetch the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch generated image: ${response.status}`
              );
            }
            const imageBlob = await response.blob();

            // Save the character sheet image to R2 storage
            const storageResult = await uploadFile(
              STORAGE_BUCKETS.CHARACTERS,
              storagePath,
              imageBlob,
              { contentType: 'image/png' }
            );

            // Create the sequence_characters record
            return await createSequenceCharacter({
              id: characterId,
              sequenceId: input.sequenceId,
              characterId: character.characterId,
              name: character.name,
              metadata: character,
              sheetImageUrl: storageResult.publicUrl,
              sheetImagePath: storageResult.path,
              sheetStatus: 'completed' as const,
            });
          }
          return {
            id: characterId,
            characterId: character.characterId,
            name: character.name,
            metadata: character,
            sheetImageUrl: imageUrl,
            sheetStatus: 'completed' as const,
          };
        });
      })
    );

    // Emit Phase 3 complete
    await context.run('character-bible-complete', async () => {
      await getGenerationChannel(input.sequenceId).emit(
        'generation.phase:complete',
        { phase: 3 }
      );
    });
    return seqCharacters;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      return `Character sheet generation failed`;
    },
  }
);
