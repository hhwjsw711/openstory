/**
 * Sequence Characters Server Functions
 * Functions for sequence-specific character (talent) operations
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

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

    const updatedCharacter = await context.scopedDb.characters.updateTalent(
      data.characterId,
      data.talentId
    );

    await context.scopedDb.characters.updateSheetStatus(
      data.characterId,
      'generating'
    );

    await getGenerationChannel(character.sequenceId).emit(
      'generation.character-sheet:progress',
      { characterId: data.characterId, status: 'generating' }
    );

    const affectedFrameIds =
      await context.scopedDb.characters.getFrameIdsForCharacter(
        character.sequenceId,
        data.characterId
      );

    const workflowInput: RecastCharacterWorkflowInput = {
      characterDbId: data.characterId,
      characterName: character.name,
      characterMetadata: {
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
      sequenceId: character.sequenceId,
      teamId: context.teamId,
      userId: context.user.id,
      referenceImageUrl: defaultSheet?.imageUrl ?? undefined,
      talentMetadata: defaultSheet?.metadata ?? undefined,
      talentDescription: talentWithSheets.description ?? undefined,
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
