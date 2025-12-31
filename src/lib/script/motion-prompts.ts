/**
 * Phase 4: Motion Prompt Generation
 *
 * Generates camera movement and motion prompts for video generation.
 * Builds on visual prompts to add temporal dimension.
 */

import {
  callOpenRouterStream,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  motionPromptSchema,
  sceneSchema,
  type Scene,
} from '@/lib/ai/scene-analysis.schema';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import { z } from 'zod';

/**
 * Schema for motion prompt generation validation.
 * Uses .pick().required() from canonical sceneSchema and extends with prompts.motion.
 *
 * Note: The motion field uses a preprocess to handle AI model variations.
 * Some models return motion as an array instead of an object - we take the first element.
 */
export const motionPromptGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status: success, error, or rejected' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
        })
        .required()
        .extend({
          prompts: z
            .object({
              // Handle AI returning motion as array (take first element) or object
              motion: z
                .preprocess((val) => {
                  if (Array.isArray(val) && val.length > 0) {
                    console.warn(
                      '[MotionPrompts] AI returned motion as array, using first element'
                    );
                    return val[0];
                  }
                  return val;
                }, motionPromptSchema)
                .meta({ description: 'Motion/video generation prompt data' }),
            })
            .meta({ description: 'Motion generation prompts for this scene' }),
        })
    )
    .meta({ description: 'Array of scenes with motion prompts' }),
});

/**
 * Generate motion prompts for a batch of scenes
 *
 * @param scenes - Scenes with visual prompts to generate motion for
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Enriched scenes with motion prompts
 */
export async function generateMotionPromptsForScenes(
  scenes: Scene[],
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<Scene[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Fetch prompt from Langfuse
  const { prompt, compiled } = await getPrompt(
    'velro/phase/motion-prompt-generation'
  );

  // Build user prompt with scenes (including visual prompts for context)
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Generate motion prompts for the scenes based on their visual prompts.

<SCENES>
${scenesJson}
</SCENES>`;

  let finalContent = '';

  // Stream the response with structured outputs
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(compiled), userMessage(userPrompt)],
    prompt, // Link to trace
    observationName: 'phase-4-motion-prompts',
    tags: ['motion-prompts', 'phase-4', 'analysis'],
    metadata: {
      phase: 4,
      phaseName: 'Motion Prompt Generation',
      sceneCount: scenes.length,
    },
    responseSchema: motionPromptGenerationResultSchema, // Enforce JSON schema at API level
  })) {
    finalContent = chunk.accumulated;

    // Notify caller of progress (only 'chunk' during streaming)
    if (onProgress && !chunk.done) {
      onProgress({
        type: 'chunk',
        text: finalContent,
      });
    }

    if (chunk.done) break;
  }

  if (!finalContent) {
    throw new Error('AI response contained no content');
  }

  // Parse JSON directly - structured outputs guarantees valid JSON
  const validated = motionPromptGenerationResultSchema.parse(
    JSON.parse(finalContent)
  );

  // Merge enrichment data back into input scenes
  const expectedSceneIds = scenes.map((s) => s.sceneId);
  const receivedSceneIds = validated.scenes.map((s) => s.sceneId);

  const enrichedScenes: Scene[] = scenes.map((scene) => {
    const enrichment = validated.scenes.find(
      (s) => s.sceneId === scene.sceneId
    );
    if (!enrichment) {
      throw new Error(
        `Scene ID mismatch in motion prompts: expected "${scene.sceneId}" but AI returned [${receivedSceneIds.join(', ')}]. ` +
          `Input had [${expectedSceneIds.join(', ')}].`
      );
    }

    return {
      ...scene,
      prompts: {
        visual: scene.prompts?.visual || {
          fullPrompt: '',
          negativePrompt: '',
          components: {
            sceneDescription: '',
            subject: '',
            environment: '',
            lighting: '',
            camera: '',
            composition: '',
            style: '',
            technical: '',
            atmosphere: '',
          },
        },
        motion: enrichment.prompts.motion,
      },
    };
  });

  // Notify with final parsed result
  if (onProgress) {
    onProgress({
      type: 'complete',
      text: finalContent,
      parsed: enrichedScenes,
    });
  }

  return enrichedScenes;
}
