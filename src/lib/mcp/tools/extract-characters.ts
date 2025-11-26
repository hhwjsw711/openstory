/**
 * Extract Characters Tool - MCP Integration
 * Phase 2: Extracts character bible from scenes
 */

import { extractCharacterBible } from '@/lib/script/character-extraction';
import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { Scene } from '@/lib/script';

export type ExtractCharactersInput = {
  scenes: Scene[];
};

export type ExtractCharactersOutput = {
  characterBible: CharacterBibleEntry[];
};

/**
 * Extract character bible from scenes
 */
export async function extractCharactersTool(
  input: ExtractCharactersInput
): Promise<ExtractCharactersOutput> {
  try {
    console.log(
      `[MCP Extract Characters] Analyzing ${input.scenes.length} scenes for characters`
    );

    const characterBible = await extractCharacterBible(input.scenes);

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
  inputSchema: {
    type: 'object',
    properties: {
      scenes: {
        type: 'array',
        description: 'Array of scenes from split_scenes output',
        items: {
          type: 'object',
        },
      },
    },
    required: ['scenes'],
  },
};
