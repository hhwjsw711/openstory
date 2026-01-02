/**
 * Visual Prompt Generation Workflow
 *
 * Generates visual prompts for scenes based on character bible and style config.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import type { VisualPromptWorkflowInput } from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { getGenerationChannel } from '@/lib/realtime';
import type { Scene } from '@/lib/script/types';
import { visualPromptGenerationResultSchema } from '@/lib/script/visual-prompts';
import { updateFrame } from '@/lib/db/helpers/frames';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { durableLLMCall } from './llm-call-helper';

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

    // ============================================================
    // PHASE 3: Visual Prompt Generation (using durableLLMCall helper)
    // ============================================================

    const { scenes: partialScenesWithVisualPrompts } = await durableLLMCall(
      context,
      {
        name: 'visual-prompts',
        phase: { number: 4, name: 'Visual Prompts' },

        promptName: 'velro/phase/visual-prompt-generation-chat',
        promptVariables: {
          scenes: JSON.stringify(scenes, null, 2),
          characterBible: JSON.stringify(characterBible, null, 2),
          styleConfig: JSON.stringify(styleConfig, null, 2),
          aspectRatio,
        },

        modelId: analysisModelId,
        responseSchema: visualPromptGenerationResultSchema,

        additionalMetadata: {
          sceneCount: scenes.length,
        },
      },
      { sequenceId, userId: input.userId }
    );

    // Merge in the response
    const scenesWithVisualPrompts: Scene[] = scenes.map((scene) => {
      const enrichment = partialScenesWithVisualPrompts.find(
        (s) => s.sceneId === scene.sceneId
      );
      if (!enrichment) {
        throw new WorkflowValidationError(
          `Scene ID mismatch in visual prompts: expected "${scene.sceneId}" but AI returned [${partialScenesWithVisualPrompts.map((s) => s.sceneId).join(', ')}]. ` +
            `Input had [${scenes.map((s) => s.sceneId).join(', ')}].`
        );
      }
      return {
        ...scene,
        prompts: {
          ...scene.prompts,
          visual: enrichment.prompts.visual,
        },
        continuity: enrichment.continuity,
      };
    });
    if (sequenceId) {
      // Update frames with visual prompt data (Phase 3)
      await context.run('update-frames-after-visual-prompts', async () => {
        await Promise.all(
          scenesWithVisualPrompts.map(async (scene) => {
            const frame = frameMapping.find(
              (frame) => frame.sceneId === scene.sceneId
            );
            if (!frame) return;
            await updateFrame(frame.frameId, { metadata: scene });
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

    return scenesWithVisualPrompts;
  },
  {
    failureFunction: async () => {
      return `Visual prompt generation failed`;
    },
  }
);
