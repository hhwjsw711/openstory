/**
 * Sequence Characters Server Functions
 * Functions for sequence-specific character (talent) operations
 */

import {
  getFrameIdsForCharacter,
  getSequenceCharactersWithTalent,
  updateCharacterTalent,
  updateSheetStatus,
} from '@/lib/db/helpers/sequence-characters';
import { getTalentWithRelations } from '@/lib/db/helpers/talent';
import { characters as charactersTable } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { triggerWorkflow } from '@/lib/workflow/client';
import type { RecastCharacterWorkflowInput } from '@/lib/workflow/types';
import { getDb } from '#db-client';
import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authWithTeamMiddleware, sequenceAccessMiddleware } from './middleware';

/**
 * Get all characters for a sequence
 * Returns characters extracted from the script with their reference sheets and assigned talent
 */
export const getSequenceCharactersFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    return getSequenceCharactersWithTalent(context.sequence.id);
  });

// =============================================================================
// Frame-Character Operations
// =============================================================================

const getFrameIdsForCharacterInputSchema = z.object({
  characterId: z.string().min(1),
});

/**
 * Get frame IDs for all frames containing a specific character
 * Used to show the count of affected frames before recasting
 */
export const getFrameIdsForCharacterFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(getFrameIdsForCharacterInputSchema))
  .handler(async ({ context, data }) => {
    const frameIds = await getFrameIdsForCharacter(
      context.sequence.id,
      data.characterId
    );
    return { frameIds, count: frameIds.length };
  });

// =============================================================================
// Recast Operations
// =============================================================================

const recastCharacterInputSchema = z.object({
  characterId: z.string().min(1),
  talentId: ulidSchema,
});

/**
 * Recast a character with a different talent from the library
 * This updates the character's talentId and triggers character sheet regeneration
 */
export const recastCharacterFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(recastCharacterInputSchema))
  .handler(async ({ context, data }) => {
    // Get the character
    const [character] = await getDb()
      .select()
      .from(charactersTable)
      .where(eq(charactersTable.id, data.characterId));

    if (!character) {
      throw new Error('Character not found');
    }

    // Get the talent with sheets to verify it exists and belongs to the team
    const talentWithSheets = await getTalentWithRelations(data.talentId);
    if (!talentWithSheets) {
      throw new Error('Talent not found');
    }
    if (talentWithSheets.teamId !== context.teamId) {
      throw new Error('Talent does not belong to your team');
    }

    // Get the talent's default sheet for reference (first sheet with isDefault or first sheet)
    const defaultSheet =
      talentWithSheets.sheets?.find((s) => s.isDefault) ??
      talentWithSheets.sheets?.[0];

    // Update the character's talentId
    const updatedCharacter = await updateCharacterTalent(
      data.characterId,
      data.talentId
    );

    // Set sheet status to generating
    await updateSheetStatus(data.characterId, 'generating');

    // Emit immediate realtime event so UI shows generating state instantly
    await getGenerationChannel(character.sequenceId).emit(
      'generation.character-sheet:progress',
      {
        characterId: data.characterId,
        status: 'generating',
      }
    );

    // Get affected frame IDs BEFORE triggering workflow (needed for chained regeneration)
    const affectedFrameIds = await getFrameIdsForCharacter(
      character.sequenceId,
      data.characterId
    );

    // Build character metadata from the existing character
    const characterMetadata = {
      characterId: character.characterId,
      name: character.name,
      age: character.age,
      gender: character.gender ?? '',
      ethnicity: character.ethnicity ?? '',
      physicalDescription: character.physicalDescription ?? '',
      standardClothing: character.standardClothing ?? '',
      distinguishingFeatures: character.distinguishingFeatures ?? '',
      consistencyTag: character.consistencyTag ?? '',
      firstMention: {
        sceneId: character.firstMentionSceneId ?? '',
        originalText: character.firstMentionText ?? '',
        lineNumber: character.firstMentionLine ?? 0,
      },
    };

    // Trigger recast workflow which orchestrates sheet generation + frame regeneration
    const workflowInput: RecastCharacterWorkflowInput = {
      characterDbId: data.characterId,
      characterName: character.name,
      characterMetadata: characterMetadata,
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
