/**
 * Motion Prompt Scene Workflow
 *
 * Generates motion prompts for a single scene based on character bible and style config.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type { MotionPromptSceneWorkflowInput } from '@/lib/workflow/types';
import {
  type MotionPrompt,
  motionPromptSchema,
} from '../ai/scene-analysis.schema';
import { durableLLMCall } from './llm-call-helper';

export const motionPromptSceneWorkflow = createScopedWorkflow<
  MotionPromptSceneWorkflowInput,
  { sceneId: string; motionPrompt: MotionPrompt }
>(
  async (context, scopedDb) => {
    const input = context.requestPayload;
    const {
      scenes,
      sceneIndex,
      aspectRatio,
      characterBible,
      styleConfig,
      analysisModelId,
    } = input;

    console.log(
      `[MotionPromptSceneWorkflow] Generating motion prompt for scene ${sceneIndex + 1}/${scenes.length}`
    );

    // ============================================================
    // PHASE 3: Motion Prompt Generation (using durableLLMCall helper)
    // ============================================================

    const { promptVariables, additionalMetadata } = await context.run(
      'prepare-motion-prompt-generation',
      async () => {
        return {
          promptVariables: {
            sceneBefore:
              sceneIndex > 0
                ? JSON.stringify(scenes[sceneIndex - 1], null, 2)
                : '(none)',
            sceneAfter:
              sceneIndex < scenes.length - 1
                ? JSON.stringify(scenes[sceneIndex + 1], null, 2)
                : '(none)',
            scene: JSON.stringify(scenes[sceneIndex], null, 2),
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
    const motionPrompt = await durableLLMCall(
      context,
      {
        name: 'motion-prompts',
        phase: { number: 5, name: 'Writing motion prompts…' },

        promptName: 'phase/motion-prompt-scene-generation-chat',
        promptVariables,

        modelId: analysisModelId,
        responseSchema: motionPromptSchema,

        additionalMetadata,
      },
      {
        // Note: don't include sequenceId as it causes the durable call to emit a generation.phase:start event
        scopedDb,
      }
    );

    return { sceneId: scenes[sceneIndex].sceneId, motionPrompt };
  },
  {
    failureFunction: async () => {
      return `Motion prompt generation failed`;
    },
  }
);
