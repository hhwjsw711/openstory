/**
 * Recast Character Workflow
 *
 * Orchestrates the full recast flow:
 * 1. Generate new character sheet with talent appearance
 * 2. Regenerate all frames containing the character
 */

import { getGenerationChannel } from '@/lib/realtime';
import type {
  CharacterSheetWorkflowInput,
  RecastCharacterWorkflowInput,
  RegenerateFramesWorkflowInput,
} from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { characterSheetWorkflow } from './character-sheet-workflow';
import { getFalFlowControl } from './constants';
import { regenerateFramesWorkflow } from './regenerate-frames-workflow';

export const recastCharacterWorkflow = createWorkflow(
  async (context: WorkflowContext<RecastCharacterWorkflowInput>) => {
    const input = context.requestPayload;

    console.log(
      '[RecastCharacterWorkflow]',
      `Starting recast for ${input.characterName} with ${input.affectedFrameIds.length} affected frames`
    );

    // Step 1: Generate new character sheet with talent appearance
    const sheetInput: CharacterSheetWorkflowInput = {
      characterDbId: input.characterDbId,
      characterName: input.characterName,
      characterMetadata: input.characterMetadata,
      sequenceId: input.sequenceId,
      teamId: input.teamId,
      userId: input.userId,
      imageModel: input.imageModel,
      referenceImageUrl: input.referenceImageUrl,
      talentMetadata: input.talentMetadata,
      talentDescription: input.talentDescription,
    };

    const { body: sheetResult, isFailed: sheetFailed } = await context.invoke(
      'character-sheet',
      {
        workflow: characterSheetWorkflow,
        body: sheetInput,
        flowControl: getFalFlowControl(),
      }
    );

    if (sheetFailed || !sheetResult?.sheetImageUrl) {
      // Retry if the character sheet generation failed
      throw new Error(
        `Character sheet generation failed for ${input.characterName}`
      );
    }

    console.log(
      '[RecastCharacterWorkflow]',
      `Character sheet generated for ${input.characterName}, regenerating ${input.affectedFrameIds.length} frames`
    );

    // Step 2: Regenerate frames if there are any affected
    if (input.affectedFrameIds.length > 0) {
      const regenerateInput: RegenerateFramesWorkflowInput = {
        sequenceId: input.sequenceId,
        userId: input.userId,
        teamId: input.teamId,
        frameIds: input.affectedFrameIds,
        triggeringCharacterId: input.characterDbId,
        imageModel: input.imageModel,
      };

      const { body: regenerateResult, isFailed: regenerateFailed } =
        await context.invoke('regenerate-frames', {
          workflow: regenerateFramesWorkflow,
          body: regenerateInput,
          flowControl: getFalFlowControl(),
        });

      if (regenerateFailed) {
        console.error(
          '[RecastCharacterWorkflow]',
          `Frame regeneration failed for ${input.characterName}`
        );
        // Don't throw - sheet was generated successfully
      } else {
        console.log(
          '[RecastCharacterWorkflow]',
          `Regenerated ${regenerateResult?.successCount ?? 0} frames for ${input.characterName}`
        );
      }

      return {
        sheetImageUrl: sheetResult.sheetImageUrl,
        framesRegenerated: regenerateResult?.successCount ?? 0,
        framesFailed: regenerateResult?.failedFrames?.length ?? 0,
      };
    }

    return {
      sheetImageUrl: sheetResult.sheetImageUrl,
      framesRegenerated: 0,
      framesFailed: 0,
    };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      await getGenerationChannel(input.sequenceId).emit(
        'generation.recast:failed',
        {
          characterId: input.characterDbId,
          error: String(failResponse),
        }
      );

      console.error(
        '[RecastCharacterWorkflow]',
        `Recast failed for ${input.characterName}: ${failResponse}`
      );

      return `Recast failed for ${input.characterName}`;
    },
  }
);
