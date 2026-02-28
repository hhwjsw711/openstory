/**
 * Character Sheet Generation Workflow
 *
 * Generates character reference sheets (full body turnaround) for visual consistency.
 * These sheets are later used as reference images when generating scene images.
 *
 * When talent matches are provided, uses the talent's appearance and reference image
 * to maintain consistency with the cast.
 */

import { uploadFile } from '#storage';
import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import {
  deductWorkflowCredits,
  extractImageCost,
} from '@/lib/billing/workflow-deduction';
import { createSequenceCharacter } from '@/lib/db/helpers/sequence-characters';
import { generateId } from '@/lib/db/id';
import type { CharacterMinimal } from '@/lib/db/schema';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import { buildCharacterSheetPrompt } from '@/lib/prompts/character-prompt';
import { getGenerationChannel } from '@/lib/realtime';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import type {
  CharacterBibleWorkflowInput,
  TalentCharacterMatch,
} from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const characterBibleWorkflow = createWorkflow(
  async (
    context: WorkflowContext<CharacterBibleWorkflowInput>
  ): Promise<CharacterMinimal[]> => {
    const input = context.requestPayload;
    const { talentMatches = [] } = input;

    // Create lookup map for talent matches
    const matchMap = new Map<string, TalentCharacterMatch>(
      talentMatches.map((m) => [m.characterId, m])
    );

    // Emit Phase 3 start
    await context.run('character-bible-start', async () => {
      getGenerationChannel(input.sequenceId).emit('generation.phase:start', {
        phase: 3,
        phaseName: 'Character Bible',
      });
    });

    const seqCharacters: CharacterMinimal[] = await Promise.all(
      input.characterBible.map(async (character) => {
        return await context.run('character-sheet', async () => {
          // Check if character has a talent match
          const talentMatch = matchMap.get(character.characterId);

          // Build character sheet prompt (with talent overrides if matched)
          // Include talent name as description so AI can leverage its knowledge of famous people
          const { prompt, referenceUrls } = talentMatch
            ? buildCharacterSheetPrompt(character, {
                sheetMetadata: talentMatch.sheetMetadata,
                description: `This character should look like ${talentMatch.talentName}`,
                sheetImageUrl: talentMatch.sheetImageUrl,
              })
            : buildCharacterSheetPrompt(character);

          // Generate character sheet image
          const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

          const imageResult = await generateImageWithProvider({
            model,
            prompt,
            imageSize: 'landscape_16_9' as const,
            numImages: 1,
            resolution: '2K' as const,
            referenceImageUrls:
              referenceUrls.length > 0 ? referenceUrls : undefined,
            traceName: 'character-bible-image',
            teamId: input.teamId,
          });

          // Deduct credits (skip if team used own fal key)
          await deductWorkflowCredits({
            teamId: input.teamId,
            costUsd: extractImageCost(imageResult.metadata),
            usedOwnKey: imageResult.metadata.usedOwnKey,
            userId: input.userId,
            description: `Character bible sheet (${model})`,
            metadata: { model, characterId: character.characterId },
            workflowName: 'CharacterBibleWorkflow',
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
              age: character.age ?? '',
              gender: character.gender ?? null,
              ethnicity: character.ethnicity ?? null,
              physicalDescription: character.physicalDescription,
              standardClothing: character.standardClothing,
              distinguishingFeatures: character.distinguishingFeatures ?? null,
              consistencyTag: character.consistencyTag,
              // First mention - no longer collected from AI
              firstMentionSceneId: null,
              firstMentionText: null,
              firstMentionLine: null,
              // Sheet image
              sheetImageUrl: storageResult.publicUrl,
              sheetImagePath: storageResult.path,
              sheetStatus: 'completed' as const,
              // Talent link (if matched)
              talentId: talentMatch?.talentId ?? null,
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
      getGenerationChannel(input.sequenceId).emit('generation.phase:complete', {
        phase: 3,
      });
    });
    return seqCharacters;
  },
  {
    failureFunction: async () => {
      return `Character sheet generation failed`;
    },
  }
);
