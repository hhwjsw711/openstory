/**
 * Phase 2: Character Extraction
 *
 * Analyzes scenes to build a complete Character Bible.
 * Identifies all characters and their first appearances.
 */

import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { characterBibleEntrySchema } from '@/lib/ai/scene-analysis.schema';
import { CHARACTER_EXTRACTION_PROMPT } from '@/lib/prompts';
import { z } from 'zod';
import type { CharacterExtractionResult, Scene } from './types';

/**
 * Zod schema for validating character extraction results
 */
const characterExtractionResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  characterBible: z.array(characterBibleEntrySchema),
});

/**
 * Extract character bible from scenes
 *
 * @param scenes - Scenes to analyze for characters
 * @param model - AI model to use (defaults to fast model)
 * @returns Character extraction result with complete character bible
 */
export async function extractCharacterBible(
  scenes: Scene[],
  model: string = RECOMMENDED_MODELS.fast
): Promise<CharacterExtractionResult> {
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

  // Call AI
  const response = await callOpenRouter({
    model,
    messages: [
      systemMessage(CHARACTER_EXTRACTION_PROMPT),
      userMessage(userPrompt),
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed = extractJSON<CharacterExtractionResult>(content);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = characterExtractionResultSchema.parse(parsed);

  return validated;
}
