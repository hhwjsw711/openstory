/**
 * Phase 2: Character Extraction
 *
 * Analyzes scenes to build a complete Character Bible.
 * Identifies all characters and their first appearances.
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
  sceneAnalysisSchema,
} from '@/lib/ai/scene-analysis.schema';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import { z } from 'zod';
import type { Scene } from './types';

/**
 * Zod schema for validating character extraction results.
 * Reuses canonical schemas from scene-analysis.schema.ts for consistency and metadata.
 */

const characterExtractionResultSchema = sceneAnalysisSchema
  .pick({
    status: true,
    characterBible: true,
  })
  .required();

/**
 * Extract character bible from scenes
 *
 * @param scenes - Scenes to analyze for characters
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Character bible array
 */
export async function extractCharacterBible(
  scenes: Scene[],
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<CharacterBibleEntry[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Fetch prompt from Langfuse
  const { prompt, compiled } = await getPrompt(
    'velro/phase/character-extraction'
  );

  // Build user prompt with scenes
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Analyze the scenes within the SCENES tags and create a complete character bible.

<SCENES>
${scenesJson}
</SCENES>

For each character that appears:
1. Track their first appearance (scene_id, original_text, line_number)
2. Provide COMPLETE physical descriptions for visual consistency
3. Include clothing details that define the character
4. Add distinguishing features
5. Create a short consistency_tag for quick reference

Respond with ONLY valid JSON matching the schema.`;

  let finalContent = '';

  // Stream the response with structured outputs
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(compiled), userMessage(userPrompt)],
    prompt, // Link to trace
    observationName: 'phase-2-character-extraction',
    tags: ['character-extraction', 'phase-2', 'analysis'],
    metadata: { phase: 2, phaseName: 'Character Extraction' },
    responseSchema: characterExtractionResultSchema, // Enforce JSON schema at API level
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
  const validated = characterExtractionResultSchema.parse(
    JSON.parse(finalContent)
  );

  // Notify with final parsed result
  if (onProgress) {
    onProgress({
      type: 'complete',
      text: finalContent,
      parsed: validated.characterBible,
    });
  }

  // Extract and return character bible directly
  return validated.characterBible;
}
