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
import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import { VISUAL_PROMPT_GENERATION_PROMPT } from '@/lib/prompts';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import { z } from 'zod';
import type { BasicScene, VisualPromptGenerationResult } from './types';

/**
 * Simplified schema for visual prompt generation validation
 * (validates the enrichment data that gets added to scenes)
 */
const visualPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z.object({
        cameraAngles: z
          .array(
            z.object({
              id: z.enum(['A1', 'A2', 'A3']),
              description: z.string(),
              effect: z.string(),
            })
          )
          .length(3),
        moodTreatments: z
          .array(
            z.object({
              id: z.enum(['C1', 'C2', 'C3']),
              description: z.string(),
              tone: z.string(),
            })
          )
          .length(3),
      }),
      selectedVariant: z.object({
        cameraAngle: z.enum(['A1', 'A2', 'A3']),
        moodTreatment: z.enum(['C1', 'C2', 'C3']),
        rationale: z.string(),
      }),
      prompts: z.object({
        visual: z.object({
          fullPrompt: z.string(),
          negativePrompt: z.string(),
          components: z.object({
            sceneDescription: z.string(),
            subject: z.string(),
            environment: z.string(),
            lighting: z.string(),
            camera: z.string(),
            composition: z.string(),
            style: z.string(),
            technical: z.string(),
            atmosphere: z.string(),
          }),
          parameters: z.object({
            dimensions: z.object({
              width: z.number(),
              height: z.number(),
              aspectRatio: z.string(),
            }),
            quality: z.object({
              steps: z.number(),
              guidance: z.number(),
            }),
            control: z.object({
              seed: z.number().nullable(),
            }),
          }),
        }),
      }),
      continuity: z.object({
        characterTags: z.array(z.string()),
        environmentTag: z.string(),
        colorPalette: z.string(),
        lightingSetup: z.string(),
        styleTag: z.string().optional(),
      }),
    })
  ),
});

/**
 * Generate visual prompts for a batch of scenes
 *
 * @param scenes - Basic scenes to generate visual prompts for
 * @param characterBible - Character bible for consistency
 * @param styleConfig - Director DNA configuration
 * @param model - AI model to use (defaults to fast model)
 * @returns Visual prompt generation result
 */
export async function generateVisualPromptsForScenes(
  scenes: BasicScene[],
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
  const parsed = extractJSON<VisualPromptGenerationResult>(content);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = visualPromptGenerationResultSchema.parse(parsed);

  return validated;
}
