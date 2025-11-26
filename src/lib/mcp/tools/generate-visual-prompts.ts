/**
 * Generate Visual Prompts Tool - MCP Integration
 * Phase 3: Generates visual prompts for scenes
 */

import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { Scene } from '@/lib/script';
import { generateVisualPromptsForScenes } from '@/lib/script/visual-prompts';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';

export type GenerateVisualPromptsInput = {
  scenes: Scene[];
  characterBible: CharacterBibleEntry[];
  style: string;
};

export type GenerateVisualPromptsOutput = {
  scenes: Scene[];
};

function getStyleByName(name: string) {
  return DEFAULT_STYLE_TEMPLATES.find(
    (style) => style.name.toLowerCase() === name.toLowerCase()
  );
}

function getAllStyleNames(): string[] {
  return DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
}

/**
 * Generate visual prompts for scenes
 */
export async function generateVisualPromptsTool(
  input: GenerateVisualPromptsInput
): Promise<GenerateVisualPromptsOutput> {
  try {
    const style = getStyleByName(input.style);
    if (!style) {
      throw new Error(
        `Style "${input.style}" not found. Available: ${getAllStyleNames().join(', ')}`
      );
    }

    console.log(
      `[MCP Generate Visual Prompts] Generating prompts for ${input.scenes.length} scenes with style "${input.style}"`
    );

    const scenes = await generateVisualPromptsForScenes(
      input.scenes,
      input.characterBible,
      style.config
    );

    console.log(
      `[MCP Generate Visual Prompts] Complete: ${scenes.length} scenes enriched with visual prompts`
    );

    return { scenes };
  } catch (error) {
    console.error('[MCP Generate Visual Prompts] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const generateVisualPromptsToolDescription = {
  name: 'generate_visual_prompts',
  description: `Generate visual prompts for scenes (Phase 3 of script analysis).

This tool creates detailed image generation prompts with:
- 3 camera angle variants (A1, A2, A3)
- 3 mood/lighting treatment variants (C1, C2, C3)
- Selected variants based on director style
- Complete visual prompts (200-400 words, self-contained)
- Continuity tracking (characters, environment, colors, lighting)

Uses the Character Bible from Phase 2 to ensure visual consistency. Applies director style to all prompts.`,
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
      characterBible: {
        type: 'array',
        description: 'Character bible from extract_characters output',
        items: {
          type: 'object',
        },
      },
      style: {
        type: 'string',
        description: 'Director style name',
        enum: getAllStyleNames(),
      },
    },
    required: ['scenes', 'characterBible', 'style'],
  },
};
