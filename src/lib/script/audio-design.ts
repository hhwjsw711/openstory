/**
 * Phase 5: Audio Design
 *
 * Generates comprehensive audio design specifications for each scene.
 * Includes music, sound effects, dialogue, and ambient sound design.
 */

import {
  callOpenRouterStream,
  extractJSON,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { audioDesignSchema, type Scene } from '@/lib/ai/scene-analysis.schema';
import { AUDIO_DESIGN_PROMPT } from '@/lib/prompts';
import { z } from 'zod';

/**
 * Schema for audio design generation validation
 * Uses canonical schemas from scene-analysis.schema.ts
 */
const audioDesignGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      audioDesign: audioDesignSchema,
    })
  ),
});

/**
 * Generate audio design for a batch of scenes
 *
 * @param scenes - Scenes with visual and motion prompts to generate audio design for
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Enriched scenes with audio design
 */
export async function generateAudioDesignForScenes(
  scenes: Scene[],
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<Scene[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

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

  let finalContent = '';

  // Stream the response
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(AUDIO_DESIGN_PROMPT), userMessage(userPrompt)],
  })) {
    finalContent = chunk.accumulated;

    // Notify caller of progress
    if (onProgress) {
      onProgress({
        type: chunk.done ? 'complete' : 'chunk',
        text: finalContent,
      });
    }

    if (chunk.done) break;
  }

  if (!finalContent) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed =
    extractJSON<z.infer<typeof audioDesignGenerationResultSchema>>(
      finalContent
    );

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod (validates only the enrichment data)
  const validatedAudioDesignResult =
    audioDesignGenerationResultSchema.parse(parsed);

  // Merge enrichment data back into input scenes
  const enrichedScenes: Scene[] = scenes.map((scene) => {
    const enrichment = validatedAudioDesignResult.scenes.find(
      (s) => s.sceneId === scene.sceneId
    );
    if (!enrichment) {
      throw new Error(
        `Scene with ID ${scene.sceneId} not found in audio design result`
      );
    }
    return {
      ...scene,
      audioDesign: enrichment.audioDesign,
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
