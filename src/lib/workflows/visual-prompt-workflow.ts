/**
 * Visual Prompt Generation Workflow
 *
 * Generates visual prompts for scenes based on character bible and style config.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import type { VisualPromptWorkflowInput } from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { visualPromptSceneWorkflow } from './visual-prompt-scene-workflow';

export const visualPromptWorkflow = createWorkflow(
  async (
    context: WorkflowContext<VisualPromptWorkflowInput>
  ): Promise<Scene[]> => {
    const input = context.requestPayload;
    const {
      scenes,
      aspectRatio,
      characterBible,
      locationBible,
      styleConfig,
      analysisModelId,
    } = input;

    console.log(
      `[VisualPromptWorkflow] Starting visual prompt generation for ${scenes.length} scenes`
    );
    // ============================================================
    // PHASE 3: Visual Prompt Generation (using durableLLMCall helper)
    // ============================================================
    const visualPromptResults = await Promise.all(
      scenes.map(
        async (_scene, sceneIndex) =>
          await context.invoke('visual-prompt-scene', {
            workflow: visualPromptSceneWorkflow,
            body: {
              scenes,
              sceneIndex: sceneIndex,
              aspectRatio,
              characterBible,
              locationBible,
              styleConfig,
              analysisModelId,
              teamId: input.teamId,
              userId: input.userId,
              sequenceId: input.sequenceId,
            },
          })
      )
    );

    // Merge in the response (visual prompts AND continuity)
    const { scenes: scenesWithVisualPrompts } = await context.run(
      'merge-visual-prompts',
      async () => {
        return {
          scenes: scenes.map((scene) => {
            const enrichment = visualPromptResults.find(
              (s) => s.body.sceneId === scene.sceneId
            );
            if (!enrichment) {
              throw new WorkflowValidationError(
                `Scene ID mismatch in visual prompts: expected "${scene.sceneId}" but AI returned [${visualPromptResults.map((s) => s.body.sceneId).join(', ')}]. ` +
                  `Input had [${scenes.map((s) => s.sceneId).join(', ')}].`
              );
            }
            return {
              ...scene,
              prompts: {
                ...scene.prompts,
                visual: enrichment.body.visual,
              },
              continuity: enrichment.body.continuity,
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
