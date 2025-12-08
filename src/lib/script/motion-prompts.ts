/**
 * Phase 4: Motion Prompt Generation
 *
 * Generates camera movement and motion prompts for video generation.
 * Builds on visual prompts to add temporal dimension.
 */

import {
  callOpenRouterStream,
  extractJSON,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  motionPromptSchema,
  movementStyleVariantSchema,
  type Scene,
} from '@/lib/ai/scene-analysis.schema';
import { getMotionPromptGenerationPrompt } from '@/lib/prompts';
import { z } from 'zod';

/**
 * Schema for motion prompt generation validation
 * Uses canonical schemas from scene-analysis.schema.ts
 */
const motionPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z
        .object({
          movementStyles: z.array(movementStyleVariantSchema).length(3),
        })
        .optional(),
      selectedVariant: z
        .object({
          movementStyle: z.enum(['B1', 'B2', 'B3']),
          rationale: z.string().optional(),
        })
        .optional(),
      prompts: z.object({
        motion: motionPromptSchema,
      }),
    })
  ),
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
    includeVariants?: boolean;
  }
): Promise<Scene[]> {
  const { model = RECOMMENDED_MODELS.fast, includeVariants = false } =
    options ?? {};

  // Build user prompt with scenes (including visual prompts for context)
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Generate motion prompts for the scenes based on their visual prompts.

<SCENES>
${scenesJson}
</SCENES>`;

  let finalContent = '';

  // Stream the response
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [
      systemMessage(getMotionPromptGenerationPrompt(includeVariants)),
      userMessage(userPrompt),
    ],
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

  // Extract JSON from response
  const parsed = extractJSON(finalContent);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod (validates only the enrichment data)
  const validated = motionPromptGenerationResultSchema.parse(parsed);

  // Merge enrichment data back into input scenes
  const enrichedScenes: Scene[] = scenes.map((scene) => {
    const enrichment = validated.scenes.find(
      (s) => s.sceneId === scene.sceneId
    );
    if (!enrichment) {
      throw new Error(
        `Scene with ID ${scene.sceneId} not found in motion prompt result`
      );
    }

    if (!includeVariants) {
      return {
        ...scene,
        prompts: {
          ...scene.prompts,
          motion: enrichment.prompts.motion,
        },
      };
    }

    // At this point (phase 4), scene must have visual prompt data from phase 3 and variants data from phase 4
    if (
      !scene.variants?.cameraAngles ||
      !scene.variants?.moodTreatments ||
      !scene.selectedVariant?.cameraAngle ||
      !scene.selectedVariant?.moodTreatment
    ) {
      throw new Error(
        `Scene ${scene.sceneId} missing visual variants from phase 3`
      );
    }

    return {
      ...scene,

      variants: {
        cameraAngles: scene.variants.cameraAngles,
        moodTreatments: scene.variants.moodTreatments,
        movementStyles: enrichment.variants?.movementStyles,
      },
      selectedVariant: {
        cameraAngle: scene.selectedVariant.cameraAngle,
        moodTreatment: scene.selectedVariant.moodTreatment,
        movementStyle: enrichment.selectedVariant?.movementStyle,
        rationale: enrichment.selectedVariant?.rationale,
      },

      prompts: {
        ...scene.prompts,
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
