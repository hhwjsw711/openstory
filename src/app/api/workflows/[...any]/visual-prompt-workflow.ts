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
  VisualPromptWorkflowInput,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/nextjs';
import { SequenceCharacter } from '@/lib/db/schema';
import { generateId } from 'better-auth';
import { SequenceCharacterMinimal } from '@/lib/db/schema/sequence-characters';
import { getGenerationChannel } from '@/lib/realtime';
import { Scene } from '@/lib/script/types';
import { generateVisualPromptsForScenes } from '@/lib/script';
import { ProgressCallback } from '@/lib/ai/openrouter-client';
import { frameService } from '@/lib/services/frame.service';

export const maxDuration = 800;

export const visualPromptWorkflow = createWorkflow(
  async (
    context: WorkflowContext<VisualPromptWorkflowInput>
  ): Promise<Scene[]> => {
    const input = context.requestPayload;
    const {
      scenes,
      aspectRatio,
      characterBible,
      styleConfig,
      analysisModelId,
      sequenceId,
      frameMapping,
    } = input;
    // Emit Phase 4 start
    await context.run('visual-prompts-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 4,
        phaseName: 'Visual Prompts',
      });
    });

    // ------------------------------------------------------------
    // Step 5: Generate visual prompts for each batch
    const visualPromptResults: Scene[][] = await Promise.all(
      scenes.map(async (scene, batchIndex) => {
        return context.run(`visual-prompts-batch-${batchIndex}`, async () => {
          const generateVisualPromptsProgressCallback: ProgressCallback =
            (progress: {
              type: 'chunk' | 'complete';
              text: string;
              parsed?: unknown;
            }) => {};
          return await generateVisualPromptsForScenes(
            [scene],
            aspectRatio,
            characterBible,
            styleConfig,
            generateVisualPromptsProgressCallback,
            { model: analysisModelId }
          );
        });
      })
    );
    const scenesWithVisualPrompts = visualPromptResults.flat();

    if (sequenceId) {
      // Update frames with visual prompt data (Phase 3)
      await context.run('update-frames-after-visual-prompts', async () => {
        await Promise.all(
          scenesWithVisualPrompts.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await frameService.updateFrame({
              id: frame.frameId,
              metadata: scene,
            });
            await getGenerationChannel(sequenceId).emit(
              'generation.frame:updated',
              {
                frameId: frame.frameId,
                updateType: 'visual-prompt',
                metadata: scene,
              }
            );
          })
        );
      });
    }
    // Emit Phase 3 complete
    await context.run('visual-prompts-complete', async () => {
      await getGenerationChannel(input.sequenceId).emit(
        'generation.phase:complete',
        { phase: 4 }
      );
    });
    return scenesWithVisualPrompts;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      return `Character sheet generation failed`;
    },
  }
);
