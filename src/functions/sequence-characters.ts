/**
 * Sequence Characters Server Functions
 * Functions for sequence-specific character (talent) operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { buildCastingAttributes } from '@/lib/prompts/character-prompt';
import { getGenerationChannel } from '@/lib/realtime';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { RecastCharacterWorkflowInput } from '@/lib/workflow/types';

import { authWithTeamMiddleware, sequenceAccessMiddleware } from './middleware';

/** Get all characters for a sequence with their assigned talent */
export const getSequenceCharactersFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    return context.scopedDb.characters.listWithTalent(context.sequence.id);
  });

/** Get frame IDs for all frames containing a specific character */
export const getFrameIdsForCharacterFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(z.object({ characterId: z.string().min(1) })))
  .handler(async ({ context, data }) => {
    const frameIds = await context.scopedDb.characters.getFrameIdsForCharacter(
      context.sequence.id,
      data.characterId
    );
    return { frameIds, count: frameIds.length };
  });

/** Recast a character with different talent, triggering sheet regeneration */
export const recastCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(
    zodValidator(
      z.object({ characterId: z.string().min(1), talentId: ulidSchema })
    )
  )
  .handler(async ({ context, data }) => {
    const character = await context.scopedDb.characters.getById(
      data.characterId
    );
    if (!character) {
      throw new Error('Character not found');
    }

    const talentWithSheets = await context.scopedDb.talent.getWithRelations(
      data.talentId
    );
    if (!talentWithSheets) {
      throw new Error('Talent not found');
    }
    if (talentWithSheets.teamId !== context.teamId) {
      throw new Error('Talent does not belong to your team');
    }

    const defaultSheet =
      talentWithSheets.sheets?.find((s) => s.isDefault) ??
      talentWithSheets.sheets?.[0];

    // Merge talent appearance with character role attributes
    const castingAttrs = buildCastingAttributes(
      {
        characterId: character.characterId,
        name: character.name,
        age: character.age,
        gender: character.gender ?? '',
        ethnicity: character.ethnicity ?? '',
        physicalDescription: character.physicalDescription ?? '',
        standardClothing: character.standardClothing ?? '',
        distinguishingFeatures: character.distinguishingFeatures ?? '',
        consistencyTag: character.consistencyTag ?? '',
      },
      {
        sheetMetadata: defaultSheet?.metadata ?? undefined,
        talentName: talentWithSheets.name,
        talentDescription: talentWithSheets.description ?? undefined,
      }
    );

    // Update talent assignment AND physical attributes from talent
    await context.scopedDb.characters.updateTalent(
      data.characterId,
      data.talentId
    );
    const updatedCharacter = await context.scopedDb.characters.update(
      data.characterId,
      {
        age: castingAttrs.age,
        gender: castingAttrs.gender,
        ethnicity: castingAttrs.ethnicity,
        physicalDescription: castingAttrs.physicalDescription,
        consistencyTag: castingAttrs.consistencyTag,
      }
    );

    const affectedFrameIds =
      await context.scopedDb.characters.getFrameIdsForCharacter(
        character.sequenceId,
        data.characterId
      );

    // If talent has a completed sheet, use it directly as the character sheet
    // This avoids content filter issues with re-generating celebrity likenesses
    const hasTalentSheet = !!defaultSheet?.imageUrl;

    if (hasTalentSheet) {
      // Use talent sheet directly — no need to regenerate
      await context.scopedDb.characters.updateSheet(
        data.characterId,
        defaultSheet?.imageUrl ?? '',
        defaultSheet?.imagePath ?? ''
      );

      await getGenerationChannel(character.sequenceId).emit(
        'generation.character-sheet:progress',
        {
          characterId: data.characterId,
          status: 'completed',
          sheetImageUrl: defaultSheet.imageUrl ?? undefined,
        }
      );

      // Still regenerate affected frames with the new character reference
      if (affectedFrameIds.length > 0) {
        const workflowInput: RecastCharacterWorkflowInput = {
          characterDbId: data.characterId,
          characterName: character.name,
          characterMetadata: {
            characterId: character.characterId,
            name: character.name,
            ...castingAttrs,
          },
          sequenceId: character.sequenceId,
          teamId: context.teamId,
          userId: context.user.id,
          referenceImageUrl: defaultSheet.imageUrl ?? undefined,
          talentMetadata: defaultSheet.metadata ?? undefined,
          talentDescription:
            `This character must look exactly like ${talentWithSheets.name}. ${talentWithSheets.description ?? ''}`.trim(),
          affectedFrameIds,
          skipSheetGeneration: true,
        };

        const workflowRunId = await triggerWorkflow(
          '/recast-character',
          workflowInput
        );

        return {
          character: updatedCharacter,
          talentId: data.talentId,
          sheetWorkflowRunId: workflowRunId,
          affectedFrameIds,
        };
      }

      return {
        character: updatedCharacter,
        talentId: data.talentId,
        sheetWorkflowRunId: undefined,
        affectedFrameIds,
      };
    }

    // Fallback: no talent sheet available, generate one
    await context.scopedDb.characters.updateSheetStatus(
      data.characterId,
      'generating'
    );

    await getGenerationChannel(character.sequenceId).emit(
      'generation.character-sheet:progress',
      { characterId: data.characterId, status: 'generating' }
    );

    const workflowInput: RecastCharacterWorkflowInput = {
      characterDbId: data.characterId,
      characterName: character.name,
      characterMetadata: {
        characterId: character.characterId,
        name: character.name,
        ...castingAttrs,
      },
      sequenceId: character.sequenceId,
      teamId: context.teamId,
      userId: context.user.id,
      referenceImageUrl: defaultSheet?.imageUrl ?? undefined,
      talentMetadata: defaultSheet?.metadata ?? undefined,
      talentDescription:
        `This character must look exactly like ${talentWithSheets.name}. ${talentWithSheets.description ?? ''}`.trim(),
      affectedFrameIds,
    };

    const workflowRunId = await triggerWorkflow(
      '/recast-character',
      workflowInput
    );

    return {
      character: updatedCharacter,
      talentId: data.talentId,
      sheetWorkflowRunId: workflowRunId,
      affectedFrameIds,
    };
  });
