/**
 * Phase 4: Motion Prompt Generation
 *
 * Generates camera movement and motion prompts for video generation.
 * Builds on visual prompts to add temporal dimension.
 */

import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { MOTION_PROMPT_GENERATION_PROMPT } from '@/lib/prompts';
import { z } from 'zod';
import type {
  MotionPromptGenerationResult,
  SceneWithVisualPrompts,
} from './types';

/**
 * Simplified schema for motion prompt generation validation
 */
const motionPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z.object({
        movementStyles: z
          .array(
            z.object({
              id: z.enum(['B1', 'B2', 'B3']),
              description: z.string(),
              energy: z
                .string()
                .transform((v) => v.toLowerCase())
                .pipe(z.enum(['low', 'medium', 'high']))
                .catch('medium'),
            })
          )
          .length(3),
      }),
      selectedVariant: z.object({
        movementStyle: z.enum(['B1', 'B2', 'B3']),
        rationale: z.string().optional(),
      }),
      prompts: z.object({
        motion: z.object({
          fullPrompt: z.string(),
          components: z.object({
            cameraMovement: z.string(),
            startPosition: z.string(),
            endPosition: z.string(),
            durationSeconds: z.number(),
            speed: z.string(),
            smoothness: z.string(),
            subjectTracking: z.string(),
            equipment: z.string(),
          }),
          parameters: z.object({
            durationSeconds: z.number(),
            fps: z.number(),
            motionAmount: z.enum(['low', 'medium', 'high']),
            cameraControl: z.object({
              pan: z.number(),
              tilt: z.number(),
              zoom: z.number(),
              movement: z.enum([
                'static',
                'dolly',
                'pan',
                'tilt',
                'tracking',
                'crane',
              ]),
            }),
          }),
        }),
      }),
    })
  ),
});

/**
 * Generate motion prompts for a batch of scenes
 *
 * @param scenes - Scenes with visual prompts to generate motion for
 * @param model - AI model to use (defaults to fast model)
 * @returns Motion prompt generation result
 */
export async function generateMotionPromptsForScenes(
  scenes: SceneWithVisualPrompts[],
  model: string = RECOMMENDED_MODELS.fast
): Promise<MotionPromptGenerationResult> {
  // Build user prompt with scenes (including visual prompts for context)
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Generate motion prompts for the scenes based on their visual prompts.

<SCENES>
${scenesJson}
</SCENES>

For each scene:
1. Generate 3 movement style variants (B1: low energy/static, B2: medium energy, B3: high energy)
2. Select best movement style based on scene's emotional needs
3. Generate complete motion prompt (100-150 words)
   - Describe camera equipment and mounting
   - Specify start position and end position
   - Include movement type, speed, and smoothness
   - Note what remains in frame throughout
   - Include duration and technical parameters

CRITICAL: Motion prompts MUST be self-contained. AI video generators have ZERO memory.

Respond with ONLY valid JSON matching the schema.`;

  // Call AI
  const response = await callOpenRouter({
    model,
    messages: [
      systemMessage(MOTION_PROMPT_GENERATION_PROMPT),
      userMessage(userPrompt),
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed = extractJSON<MotionPromptGenerationResult>(content);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = motionPromptGenerationResultSchema.parse(parsed);

  return validated;
}
