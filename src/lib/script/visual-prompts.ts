/**
 * Phase 3: Visual Prompt Generation
 *
 * Generates complete visual prompts with variants and continuity tracking.
 * Uses Character Bible for consistency across all scenes.
 */

import {
  callOpenRouterStream,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  type CharacterBibleEntry,
  continuitySchema,
  sceneSchema,
  type Scene,
  visualPromptSchema,
} from '@/lib/ai/scene-analysis.schema';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import { z } from 'zod';

/**
 * Schema for visual prompt generation validation.
 * Uses .pick().required() from canonical sceneSchema and extends with prompts.visual + continuity.
 */
export const visualPromptGenerationResultSchema = z.object({
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
          visual: visualPromptSchema.meta({
            description: 'Image generation prompt data',
          }),
          continuity: continuitySchema.meta({
            description: 'Continuity tracking for scene consistency',
          }),
        })
    )
    .meta({ description: 'Array of scenes with visual prompts' }),
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

  // Fetch prompt from Langfuse
  const { prompt, compiled } = await getPrompt(
    'velro/phase/visual-prompt-generation'
  );

  // Build user prompt with scenes, character bible, and style config
  const scenesJson = JSON.stringify(scenes, null, 2);
  const characterBibleJson = JSON.stringify(characterBible, null, 2);
  const styleConfigJson = JSON.stringify(styleConfig, null, 2);

  const userPrompt = `Generate complete visual prompts for the scenes using the character bible, director style, and aspect ratio.

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

  // Stream the response with structured outputs
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(compiled), userMessage(userPrompt)],
    prompt, // Link to trace
    observationName: 'phase-3-visual-prompts',
    tags: ['visual-prompts', 'phase-3', 'analysis'],
    metadata: {
      phase: 3,
      phaseName: 'Visual Prompt Generation',
      sceneCount: scenes.length,
    },
    responseSchema: visualPromptGenerationResultSchema, // Enforce JSON schema at API level
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
  const validated = visualPromptGenerationResultSchema.parse(
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
        `Scene ID mismatch in visual prompts: expected "${scene.sceneId}" but AI returned [${receivedSceneIds.join(', ')}]. ` +
          `Input had [${expectedSceneIds.join(', ')}].`
      );
    }
    return {
      ...scene,
      prompts: {
        ...scene.prompts,
        visual: enrichment.visual,
      },
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
