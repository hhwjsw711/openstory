/**
 * Visual Prompt Generation Workflow
 *
 * Generates visual prompts for scenes based on character bible and style config.
 * Uses three-step durable pattern: prepare → context.call → log
 */

import type { VisualPromptSceneWorkflowInput } from '@/lib/workflow/types';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import {
  type VisualPromptWithContinuity,
  visualPromptWithContinuitySchema,
} from '../ai/scene-analysis.schema';
import { durableLLMCall } from './llm-call-helper';

export const visualPromptSceneWorkflow = createWorkflow(
  async (
    context: WorkflowContext<VisualPromptSceneWorkflowInput>
  ): Promise<{ sceneId: string } & VisualPromptWithContinuity> => {
    const input = context.requestPayload;
    const {
      scenes,
      sceneIndex,
      aspectRatio,
      characterBible,
      locationBible,
      styleConfig,
      analysisModelId,
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
            locationBible: JSON.stringify(locationBible, null, 2),
            styleConfig: JSON.stringify(styleConfig, null, 2),
            aspectRatio,
          },
          additionalMetadata: {
            sceneCount: scenes.length,
          },
        };
      }
    );
    const result = await durableLLMCall(
      context,
      {
        name: 'visual-prompts',
        phase: { number: 4, name: 'Writing image prompts…' },

        promptName: 'phase/visual-prompt-scene-generation-chat',
        promptVariables,

        modelId: analysisModelId,
        responseSchema: visualPromptWithContinuitySchema,

        additionalMetadata,
      },
      {
        // Note don't include the sequenceId as causes the durable call to emit a generation.phase:start event
        teamId: input.teamId,
      }
    );

    return { sceneId: scenes[sceneIndex].sceneId, ...result };
  },
  {
    failureFunction: async ({ context, failStatus, failResponse }) => {
      console.error('[VisualPromptWorkflow] Failed', {
        workflowRunId: context.workflowRunId,
        failStatus,
        failResponse,
      });
      return `Visual prompt generation failed: ${failResponse}`;
    },
  }
);
