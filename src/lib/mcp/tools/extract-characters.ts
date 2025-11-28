/**
 * Extract Characters Tool - MCP Integration
 * Phase 2: Extracts character bible from scenes
 */

import type { ProgressCallback } from '@/lib/ai/openrouter-client';
import {
  sceneSchema,
  type CharacterBibleEntry,
} from '@/lib/ai/scene-analysis.schema';
import { extractCharacterBible } from '@/lib/script/character-extraction';
import { z } from 'zod';

export const extractCharactersInputSchema = z.object({
  scenes: z.array(sceneSchema),
});

export type ExtractCharactersInput = z.infer<
  typeof extractCharactersInputSchema
>;

export type ExtractCharactersOutput = {
  characterBible: CharacterBibleEntry[];
};

/**
 * Extract character bible from scenes
 *
 * @param input - Tool input containing scenes
 * @param onProgress - Optional callback for streaming progress
 */
export async function extractCharactersTool(
  input: ExtractCharactersInput,
  onProgress?: ProgressCallback
): Promise<ExtractCharactersOutput> {
  try {
    console.log(
      `[MCP Extract Characters] Analyzing ${input.scenes.length} scenes for characters`
    );

    const characterBible = await extractCharacterBible(
      input.scenes,
      onProgress
    );

    console.log(
      `[MCP Extract Characters] Complete: ${characterBible.length} characters extracted`
    );

    return { characterBible };
  } catch (error) {
    console.error('[MCP Extract Characters] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const extractCharactersToolDescription = {
  name: 'extract_characters',
  description: `Extract character bible from scenes (Phase 2 of script analysis).

This tool analyzes scenes to identify all characters and build a Character Bible with:
- Character IDs and names
- First appearance tracking (scene, original text, line number)
- Complete physical descriptions
- Standard clothing descriptions
- Distinguishing features
- Consistency tags for visual reference

The Character Bible is used in Phase 3 to ensure visual consistency across all generated images.`,
  inputSchema: extractCharactersInputSchema,
};
