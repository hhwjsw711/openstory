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

    console.log(
      '[VisualPromptWorkflow] Starting visual prompt generation input:',
      input
    );
    // ============================================================
    // PHASE 3: Visual Prompt Generation (using durableLLMCall helper)
    // ============================================================
    const { promptVariables, additionalMetadata } = await context.run(
      'prepare-visual-prompt-generation',
      async () => {
        return {
          promptVariables: {
            scenes: JSON.stringify(scenes, null, 2),
            characterBible: JSON.stringify(characterBible, null, 2),
            styleConfig: JSON.stringify(styleConfig, null, 2),
            aspectRatio,
          },
          additionalMetadata: {
            sceneCount: scenes.length,
          },
        };
      }
    );
    const { scenes: partialScenesWithVisualPrompts } = await durableLLMCall(
      context,
      {
        name: 'visual-prompts',
        phase: { number: 4, name: 'Visual Prompts' },

        promptName: 'velro/phase/visual-prompt-generation-chat',
        promptVariables,

        modelId: analysisModelId,
        responseSchema: visualPromptGenerationResultSchema,

        additionalMetadata,

        retryResponse: (validated) => {
          for (const scene of scenes) {
            const enrichment = validated.scenes.find(
              (s) => s.sceneId === scene.sceneId
            );
            if (!enrichment || !enrichment.prompts.visual.fullPrompt) {
              // Missing data, retry
              return true;
            }
          }
          // All data is present, no retry
          return false;
        },
      },
      { sequenceId, userId: input.userId }
    );

    // Merge in the response
    const { scenes: scenesWithVisualPrompts } = await context.run(
      'merge-visual-prompts',
      async () => {
        return {
          scenes: scenes.map((scene) => {
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
          }),
        };
      }
    );

    return scenesWithVisualPrompts;
  },
  {
    failureFunction: async () => {
      return `Visual prompt generation failed`;
    },
  }
);
