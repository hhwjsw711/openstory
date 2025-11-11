/**
 * Phase 5: Audio Design
 *
 * Generates comprehensive audio design specifications for each scene.
 * Includes music, sound effects, dialogue, and ambient sound design.
 */

import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { AUDIO_DESIGN_PROMPT } from '@/lib/prompts';
import { z } from 'zod';
import type {
  AudioDesignGenerationResult,
  SceneWithMotionPrompts,
} from './types';

/**
 * Simplified schema for audio design generation validation
 */
const audioDesignGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      audioDesign: z.object({
        music: z.object({
          presence: z.enum(['none', 'minimal', 'moderate', 'full']),
          style: z.string().optional(),
          mood: z.string().optional(),
          rationale: z.string().optional(),
        }),
        soundEffects: z.array(
          z.object({
            sfxId: z.string(),
            type: z.enum(['ambient', 'foley', 'mechanical', 'natural']),
            description: z.string(),
            timing: z.string(),
            volume: z.enum(['low', 'medium', 'high']),
            spatialPosition: z.enum([
              'left',
              'center',
              'right',
              'wide',
              'surround',
            ]),
          })
        ),
        dialogue: z.object({
          presence: z.boolean(),
          lines: z.array(
            z.object({
              character: z.string().nullable(),
              line: z.string(),
            })
          ),
        }),
        ambient: z.object({
          roomTone: z.string(),
          atmosphere: z.string(),
        }),
      }),
    })
  ),
});

/**
 * Generate audio design for a batch of scenes
 *
 * @param scenes - Scenes with visual and motion prompts to generate audio design for
 * @param model - AI model to use (defaults to fast model)
 * @returns Audio design generation result
 */
export async function generateAudioDesignForScenes(
  scenes: SceneWithMotionPrompts[],
  model: string = RECOMMENDED_MODELS.fast
): Promise<AudioDesignGenerationResult> {
  // Build user prompt with scenes (including visual/motion for context)
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Generate audio design for the scenes based on their visual and motion prompts.

<SCENES>
${scenesJson}
</SCENES>

For each scene, design audio across four categories:

1. MUSIC:
   - presence: "none"|"minimal"|"moderate"|"full"
   - style: Genre/instrumentation if music present
   - mood: Emotional quality
   - rationale: Why this choice fits

2. SOUND EFFECTS:
   - type: "ambient"|"foley"|"mechanical"|"natural"
   - description: Clear sound description
   - timing: When it occurs (timestamp or "continuous")
   - volume: "low"|"medium"|"high"
   - spatialPosition: "left"|"center"|"right"|"wide"|"surround"

3. DIALOGUE:
   - presence: true/false
   - lines: Extract from scene's originalScript.dialogue

4. AMBIENT:
   - roomTone: Base environmental sound
   - atmosphere: Overall sonic environment

Respond with ONLY valid JSON matching the schema.`;

  // Call AI
  const response = await callOpenRouter({
    model,
    messages: [systemMessage(AUDIO_DESIGN_PROMPT), userMessage(userPrompt)],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed = extractJSON<AudioDesignGenerationResult>(content);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = audioDesignGenerationResultSchema.parse(parsed);

  return validated;
}
