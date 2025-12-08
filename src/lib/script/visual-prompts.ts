/**
 * Phase 3: Visual Prompt Generation
 *
 * Generates complete visual prompts with variants and continuity tracking.
 * Uses Character Bible for consistency across all scenes.
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
  cameraAngleVariantSchema,
  type CharacterBibleEntry,
  continuitySchema,
  moodTreatmentVariantSchema,
  type Scene,
  visualPromptSchema,
} from '@/lib/ai/scene-analysis.schema';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { getVisualPromptGenerationPrompt } from '@/lib/prompts';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import { z } from 'zod';

/**
 * Schema for visual prompt generation validation
 * Uses canonical schemas from scene-analysis.schema.ts
 */
const visualPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z
        .object({
          cameraAngles: z.array(cameraAngleVariantSchema).length(3),
          moodTreatments: z.array(moodTreatmentVariantSchema).length(3),
        })
        .optional(),
      selectedVariant: z
        .object({
          cameraAngle: z.enum(['A1', 'A2', 'A3']),
          moodTreatment: z.enum(['C1', 'C2', 'C3']),
          rationale: z.string().optional(),
        })
        .optional(),
      prompts: z.object({
        visual: visualPromptSchema,
      }),
      continuity: continuitySchema,
    })
  ),
});

/**
 * Generate visual prompts for a batch of scenes
 *
 * @param scenes - Scenes to generate visual prompts for
 * @param characterBible - Character bible for consistency
 * @param styleConfig - Director DNA configuration
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Enriched scenes with visual prompts
 */
export async function generateVisualPromptsForScenes(
  scenes: Scene[],
  aspectRatio: AspectRatio,
  characterBible: CharacterBibleEntry[],
  styleConfig: DirectorDnaConfig,
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<Scene[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Build user prompt with scenes, character bible, and style config
  const scenesJson = JSON.stringify(scenes, null, 2);
  const characterBibleJson = JSON.stringify(characterBible, null, 2);
  const styleConfigJson = JSON.stringify(styleConfig, null, 2);

  const userPrompt = `Generate complete visual prompts for the scenes using the character bible and director style.

<SCENES>
${scenesJson}
</SCENES>

<CHARACTER_BIBLE>
${characterBibleJson}
</CHARACTER_BIBLE>

<DIRECTOR_STYLE>
${styleConfigJson}
</DIRECTOR_STYLE>

<ASPECT_RATIO>
${aspectRatio}
</ASPECT_RATIO>`;

  let finalContent = '';

  // Stream the response
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [
      systemMessage(getVisualPromptGenerationPrompt()),
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
  const validated = visualPromptGenerationResultSchema.parse(parsed);

  // Merge enrichment data back into input scenes
  const enrichedScenes: Scene[] = scenes.map((scene) => {
    const enrichment = validated.scenes.find(
      (s) => s.sceneId === scene.sceneId
    );
    if (!enrichment) {
      throw new Error(
        `Scene with ID ${scene.sceneId} not found in visual prompt result`
      );
    }
    return {
      ...scene,
      prompts: enrichment.prompts,
      continuity: enrichment.continuity,
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
