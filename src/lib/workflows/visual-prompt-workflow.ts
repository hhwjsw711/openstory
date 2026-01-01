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
import { getChatPrompt } from '@/lib/observability/langfuse-prompts';
import { logGeneration } from '@/lib/observability/langfuse';
import { getEnv } from '#env';
import { z } from 'zod';
import { WorkflowValidationError } from '@/lib/workflow/errors';

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
    // PHASE 3: Visual Prompt Generation (three-step durable pattern)
    // ============================================================

    // Step 1: Emit phase start, fetch prompts, record start time
    const {
      startTime: visualPromptStartTime,
      messages: visualPromptMessages,
      promptClient: visualPromptPromptClient,
    } = await context.run('prepare-visual-prompts', async () => {
      // Emit Phase 4 start
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 4,
        phaseName: 'Visual Prompts',
      });

      // Fetch chat prompt from Langfuse (contains both system + user messages)
      const { prompt: promptClient, messages } = await getChatPrompt(
        'velro/phase/visual-prompt-generation-chat',
        {
          scenes: JSON.stringify(scenes, null, 2),
          characterBible: JSON.stringify(characterBible, null, 2),
          styleConfig: JSON.stringify(styleConfig, null, 2),
          aspectRatio,
        }
      );

      return {
        startTime: Date.now(),
        promptClient,
        messages,
      };
    });

    // Step 2: Durable LLM call via context.api.openai
    const { body: visualPromptResponse } = await context.api.openai.call(
      'visual-prompts',
      {
        baseURL: 'https://openrouter.ai/api',
        token: getEnv().OPENROUTER_KEY,
        operation: 'chat.completions.create',
        body: {
          model: analysisModelId,
          messages: visualPromptMessages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'visual-prompt-generation',
              strict: true,
              schema: z.toJSONSchema(visualPromptGenerationResultSchema),
            },
          },
        },
      }
    );

    if (!visualPromptResponse) {
      throw new WorkflowValidationError(
        'Visual prompt generation LLM call failed - no response'
      );
    }

    // Step 3: Log to Langfuse with precise timing, parse response, merge with scenes
    const scenesWithVisualPrompts = await context.run(
      'log-visual-prompts',
      async () => {
        const content = visualPromptResponse.choices[0]?.message?.content;
        if (!content) {
          throw new WorkflowValidationError(
            'Visual prompt generation LLM response has no content'
          );
        }

        // Log to Langfuse with precise start time
        logGeneration({
          name: 'phase-3-visual-prompts',
          model: analysisModelId,
          input: visualPromptMessages,
          output: content,
          usage: visualPromptResponse.usage,
          prompt: visualPromptPromptClient,
          tags: ['visual-prompts', 'phase-3', 'analysis'],
          metadata: {
            phase: 3,
            phaseName: 'Visual Prompt Generation',
            sceneCount: scenes.length,
          },
          startTime: new Date(visualPromptStartTime),
          sequenceId,
          userId: input.userId,
        });

        // Parse and validate
        const validated = visualPromptGenerationResultSchema.parse(
          JSON.parse(content)
        );

        // Merge enrichment data back into input scenes
        const expectedSceneIds = scenes.map((s) => s.sceneId);
        const receivedSceneIds = validated.scenes.map((s) => s.sceneId);

        const enrichedScenes: Scene[] = scenes.map((scene) => {
          const enrichment = validated.scenes.find(
            (s) => s.sceneId === scene.sceneId
          );
          if (!enrichment) {
            throw new WorkflowValidationError(
              `Scene ID mismatch in visual prompts: expected "${scene.sceneId}" but AI returned [${receivedSceneIds.join(', ')}]. ` +
                `Input had [${expectedSceneIds.join(', ')}].`
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

        return enrichedScenes;
      }
    );

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
