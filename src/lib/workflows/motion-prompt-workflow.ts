/**
 * Motion Prompt Workflow
 *
 * Generates motion prompts for all scenes, delegating to per-scene sub-workflows.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import type { MotionPromptWorkflowInput } from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import type { Scene } from '@/lib/script/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { motionPromptSceneWorkflow } from './motion-prompt-scene-workflow';

export const motionPromptWorkflow = createWorkflow(
  async (
    context: WorkflowContext<MotionPromptWorkflowInput>
  ): Promise<Scene[]> => {
    const input = context.requestPayload;
    const {
      scenes,
      aspectRatio,
      characterBible,
      styleConfig,
      analysisModelId,
    } = input;

    console.log(
      '[MotionPromptWorkflow] Starting motion prompt generation input:',
      input
    );
    // ============================================================
    // PHASE 3: Motion Prompt Generation (using durableLLMCall helper)
    // ============================================================
    const motionPromptResults = await Promise.all(
      scenes.map(
        async (_scene, sceneIndex) =>
          await context.invoke('motion-prompt-scene', {
            workflow: motionPromptSceneWorkflow,
            body: {
              scenes,
              sceneIndex: sceneIndex,
              aspectRatio,
              characterBible,
              styleConfig,
              analysisModelId,
              teamId: input.teamId,
              userId: input.userId,
              sequenceId: input.sequenceId,
            },
          })
      )
    );

    // Merge in the response
    const { scenes: scenesWithMotionPrompts } = await context.run(
      'merge-motion-prompts',
      async () => {
        return {
          scenes: scenes.map((scene) => {
            const enrichment = motionPromptResults.find(
              (s) => s.body.sceneId === scene.sceneId
            );
            if (!enrichment) {
              throw new WorkflowValidationError(
                `Scene ID mismatch in motion prompts: expected "${scene.sceneId}" but AI returned [${motionPromptResults.map((s) => s.body.sceneId).join(', ')}]. ` +
                  `Input had [${scenes.map((s) => s.sceneId).join(', ')}].`
              );
            }
            return {
              ...scene,
              prompts: {
                ...scene.prompts,
                motion: enrichment.body.motionPrompt,
              },
            };
          }),
        };
      }
    );

    return scenesWithMotionPrompts;
  },
  {
    failureFunction: async () => {
      return `Motion prompt generation failed`;
    },
  }
);
