/**
 * Phase 3: Visual Prompt Generation
 *
 * Generates complete visual prompts with variants and continuity tracking.
 * Uses Character Bible for consistency across all scenes.
 */

import {
  callOpenRouter,
  extractJSON,
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
import { VISUAL_PROMPT_GENERATION_PROMPT } from '@/lib/prompts';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import { z } from 'zod';
import type { VisualPromptGenerationResult } from './types';

/**
 * Schema for visual prompt generation validation
 * Uses canonical schemas from scene-analysis.schema.ts
 */
const visualPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z.object({
        cameraAngles: z.array(cameraAngleVariantSchema).length(3),
        moodTreatments: z.array(moodTreatmentVariantSchema).length(3),
      }),
      selectedVariant: z.object({
        cameraAngle: z.enum(['A1', 'A2', 'A3']),
        moodTreatment: z.enum(['C1', 'C2', 'C3']),
        rationale: z.string().optional(),
      }),
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
 * @param model - AI model to use (defaults to fast model)
 * @returns Visual prompt generation result
 */
export async function generateVisualPromptsForScenes(
  scenes: Scene[],
  characterBible: CharacterBibleEntry[],
  styleConfig: DirectorDnaConfig,
  model: string = RECOMMENDED_MODELS.fast
): Promise<VisualPromptGenerationResult> {
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

For each scene:
1. Generate 3 camera angle variants (A1, A2, A3)
2. Generate 3 mood/lighting treatment variants (C1, C2, C3)
3. Select best variants based on director style
4. Generate complete visual prompt (200-400 words)
   - Use EXACT character descriptions from Character Bible
   - Include ALL details in prompt (no references to "same as before")
   - Apply director style consistently
5. Track continuity elements (characters, environment, colors, lighting, style)

CRITICAL: Visual prompts MUST be self-contained. AI image generators have ZERO memory.

Respond with ONLY valid JSON matching the schema.`;

  // Call AI
  const response = await callOpenRouter({
    model,
    messages: [
      systemMessage(VISUAL_PROMPT_GENERATION_PROMPT),
      userMessage(userPrompt),
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed = extractJSON(content);

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
      variants: enrichment.variants,
      selectedVariant: enrichment.selectedVariant,
      prompts: enrichment.prompts,
      continuity: enrichment.continuity,
    };
  });

  return {
    status: 'success',
    scenes: enrichedScenes,
  };
}
