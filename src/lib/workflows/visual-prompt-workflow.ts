/**
 * Visual Prompt Generation Workflow
 *
 * Generates visual prompts for scenes based on character bible and style config.
 */

import type { VisualPromptWorkflowInput } from '@/lib/workflow';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { getGenerationChannel } from '@/lib/realtime';
import type { Scene } from '@/lib/script/types';
import { generateVisualPromptsForScenes } from '@/lib/script';
import type { ProgressCallback } from '@/lib/ai/openrouter-client';
import { frameService } from '@/lib/services/frame.service';

const maxDuration = 800;

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
            () => {};
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
    failureFunction: async () => {
      return `Visual prompt generation failed`;
    },
  }
);
