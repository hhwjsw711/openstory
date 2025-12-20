/**
 * Character Sheet Generation Workflow
 *
 * Generates character reference sheets (full body turnaround) for visual consistency.
 * These sheets are later used as reference images when generating scene images.
 */

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { createSequenceCharacter } from '@/lib/db/helpers/sequence-characters';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import { STORAGE_BUCKETS, uploadFile } from '@/lib/db/helpers/storage';
import { buildCharacterSheetPrompt } from '@/lib/prompts/character-prompt';
import type { CharacterBibleWorkflowInput } from '@/lib/workflow';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { generateId } from '@/lib/db/id';
import type { CharacterMinimal } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';

export const characterBibleWorkflow = createWorkflow(
  async (
    context: WorkflowContext<CharacterBibleWorkflowInput>
  ): Promise<CharacterMinimal[]> => {
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

    const seqCharacters: CharacterMinimal[] = await Promise.all(
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
          const id = generateId();
          // Save to R2 and DB if sequenceId, userId, and teamId are provided
          if (input.sequenceId && input.userId && input.teamId) {
            // Storage path
            const storagePath = `${input.teamId}/${input.sequenceId}/${id}.png`;

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

            // Create the characters record with flattened fields
            const created = await createSequenceCharacter({
              id,
              sequenceId: input.sequenceId,
              characterId: character.characterId,
              name: character.name,
              // Flattened character bible fields
              age:
                character.age != null
                  ? typeof character.age === 'number'
                    ? String(character.age)
                    : character.age
                  : null,
              gender: character.gender ?? null,
              ethnicity: character.ethnicity ?? null,
              physicalDescription: character.physicalDescription,
              standardClothing: character.standardClothing,
              distinguishingFeatures: character.distinguishingFeatures ?? null,
              consistencyTag: character.consistencyTag,
              // First mention
              firstMentionSceneId: character.firstMention.sceneId,
              firstMentionText: character.firstMention.originalText,
              firstMentionLine: character.firstMention.lineNumber,
              // Sheet image
              sheetImageUrl: storageResult.publicUrl,
              sheetImagePath: storageResult.path,
              sheetStatus: 'completed' as const,
            });
            return {
              id: created.id,
              characterId: created.characterId,
              name: created.name,
              sheetImageUrl: created.sheetImageUrl,
              sheetStatus: created.sheetStatus,
              physicalDescription: created.physicalDescription,
              consistencyTag: created.consistencyTag,
            };
          }
          return {
            id,
            characterId: character.characterId,
            name: character.name,
            sheetImageUrl: imageUrl,
            sheetStatus: 'completed' as const,
            physicalDescription: character.physicalDescription,
            consistencyTag: character.consistencyTag,
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
    failureFunction: async () => {
      return `Character sheet generation failed`;
    },
  }
);
