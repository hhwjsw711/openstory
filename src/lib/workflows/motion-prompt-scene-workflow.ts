/**
 * Visual Prompt Generation Workflow
 *
 * Generates visual prompts for scenes based on character bible and style config.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import type { MotionPromptSceneWorkflowInput } from '@/lib/workflow/types';

import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import { durableLLMCall } from './llm-call-helper';
import {
  type MotionPrompt,
  motionPromptSchema,
} from '../ai/scene-analysis.schema';

export const motionPromptSceneWorkflow = createWorkflow(
  async (
    context: WorkflowContext<MotionPromptSceneWorkflowInput>
  ): Promise<{ sceneId: string; motionPrompt: MotionPrompt }> => {
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
      '[VisualPromptWorkflow] Starting visual prompt generation input:',
      input
    );

    // Resolve team API keys (user-provided or platform fallback)
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

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
        phase: { number: 4, name: 'Motion Prompts' },

        promptName: 'velro/phase/motion-prompt-scene-generation-chat',
        promptVariables,

        modelId: analysisModelId,
        responseSchema: motionPromptSchema,

        additionalMetadata,
      },
      {
        // Note don't include the sequenceId as causes the durable call to emit a generation.phase:start event
        openRouterApiKey: apiKeys.openRouterApiKey,
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
