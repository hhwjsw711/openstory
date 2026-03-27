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
import { generateId } from '@/lib/db/id';
import type { CharacterMinimal } from '@/lib/db/schema';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import {
  buildCastingAttributes,
  buildCharacterSheetPrompt,
} from '@/lib/prompts/character-prompt';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  CharacterBibleWorkflowInput,
  TalentCharacterMatch,
} from '@/lib/workflow/types';

export const characterBibleWorkflow = createScopedWorkflow<
  CharacterBibleWorkflowInput,
  CharacterMinimal[]
>(
  async (context, scopedDb) => {
    const input = context.requestPayload;
    const { talentMatches = [] } = input;

    // Create lookup map for talent matches
    const matchMap = new Map<string, TalentCharacterMatch>(
      talentMatches.map((m) => [m.characterId, m])
    );

    const seqCharacters: CharacterMinimal[] = await Promise.all(
      input.characterBible.map(async (character) => {
        return await context.run('character-sheet', async () => {
          // Check if character has a talent match
          const talentMatch = matchMap.get(character.characterId);

          // When talent is matched, merge attributes: physical from talent, costume from role
          const castingAttrs = talentMatch
            ? buildCastingAttributes(character, {
                sheetMetadata: talentMatch.sheetMetadata,
                talentName: talentMatch.talentName,
              })
            : null;

          // Generate character sheet (with talent appearance as reference)
          const { prompt, referenceUrls } = talentMatch
            ? buildCharacterSheetPrompt(character, {
                sheetMetadata: talentMatch.sheetMetadata,
                description: `This character must look exactly like ${talentMatch.talentName}`,
                sheetImageUrl: talentMatch.sheetImageUrl,
              })
            : buildCharacterSheetPrompt(character);

          const model = input.imageModel ?? DEFAULT_IMAGE_MODEL;

          const imageResult = await generateImageWithProvider(
            {
              model,
              prompt,
              imageSize: 'landscape_16_9' as const,
              numImages: 1,
              resolution: '2K' as const,
              referenceImageUrls:
                referenceUrls.length > 0 ? referenceUrls : undefined,
              traceName: 'character-bible-image',
            },
            { scopedDb }
          );

          await deductWorkflowCredits({
            scopedDb,
            costMicros: extractImageCost(imageResult.metadata),
            usedOwnKey: imageResult.metadata.usedOwnKey,
            description: `Character bible sheet (${model})`,
            metadata: { model, characterId: character.characterId },
            workflowName: 'CharacterBibleWorkflow',
          });

          const generatedUrl = imageResult.imageUrls[0];
          if (!generatedUrl) {
            throw new Error('No image URL returned from generation');
          }

          let sheetImageUrl: string;
          let sheetImagePath: string | undefined;

          // Upload to R2 if we have storage context
          if (input.sequenceId && input.userId && input.teamId) {
            const id = generateId();
            const storagePath = `${input.teamId}/${input.sequenceId}/${id}.png`;
            const response = await fetch(generatedUrl);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch generated image: ${response.status}`
              );
            }
            const imageBlob = await response.blob();
            const storageResult = await uploadFile(
              STORAGE_BUCKETS.CHARACTERS,
              storagePath,
              imageBlob,
              { contentType: 'image/png' }
            );
            sheetImageUrl = storageResult.publicUrl;
            sheetImagePath = storageResult.path;
          } else {
            sheetImageUrl = generatedUrl;
            sheetImagePath = undefined;
          }

          // Generate ULID-based filename
          const id = generateId();

          // Save to DB if sequenceId, userId, and teamId are provided
          if (input.sequenceId && input.userId && input.teamId) {
            const created = await scopedDb.characters.create({
              id,
              sequenceId: input.sequenceId,
              characterId: character.characterId,
              name: character.name,
              // Use talent's physical attributes when cast, otherwise script's
              age: castingAttrs?.age ?? character.age ?? '',
              gender: castingAttrs?.gender ?? character.gender ?? null,
              ethnicity: castingAttrs?.ethnicity ?? character.ethnicity ?? null,
              physicalDescription:
                castingAttrs?.physicalDescription ??
                character.physicalDescription,
              standardClothing: character.standardClothing,
              distinguishingFeatures: character.distinguishingFeatures ?? null,
              consistencyTag:
                castingAttrs?.consistencyTag ?? character.consistencyTag,
              firstMentionSceneId: null,
              firstMentionText: null,
              firstMentionLine: null,
              sheetImageUrl,
              sheetImagePath: sheetImagePath ?? null,
              sheetStatus: 'completed' as const,
              talentId: talentMatch?.talentId || null,
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
            sheetImageUrl,
            sheetStatus: 'completed' as const,
            physicalDescription:
              castingAttrs?.physicalDescription ??
              character.physicalDescription,
            consistencyTag:
              castingAttrs?.consistencyTag ?? character.consistencyTag,
          };
        });
      })
    );

    return seqCharacters;
  },
  {
    failureFunction: async () => {
      return `Character sheet generation failed`;
    },
  }
);
