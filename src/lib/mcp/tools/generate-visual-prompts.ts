/**
 * Generate Visual Prompts Tool - MCP Integration
 * Phase 3: Generates visual prompts for scenes
 */

import type { ProgressCallback } from '@/lib/ai/openrouter-client';
import {
  characterBibleEntrySchema,
  sceneSchema,
} from '@/lib/ai/scene-analysis.schema';
import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import type { Scene } from '@/lib/script';
import { generateVisualPromptsForScenes } from '@/lib/script/visual-prompts';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { z } from 'zod';

/**
 * Get all style names as tuple for enum validation
 */
function getAllStyleNamesTuple(): [string, ...string[]] {
  const names = DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
  if (names.length === 0) {
    throw new Error('No style templates available');
  }
  return names as [string, ...string[]];
}

export const generateVisualPromptsInputSchema = z.object({
  scenes: z.array(sceneSchema),
  aspectRatio: aspectRatioSchema,
  characterBible: z.array(characterBibleEntrySchema),
  style: z.enum(getAllStyleNamesTuple()),
});

export type GenerateVisualPromptsInput = z.infer<
  typeof generateVisualPromptsInputSchema
>;

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
 *
 * @param input - Tool input containing scenes, character bible, and style
 * @param onProgress - Optional callback for streaming progress
 */
export async function generateVisualPromptsTool(
  input: GenerateVisualPromptsInput,
  onProgress?: ProgressCallback
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
      input.aspectRatio,
      input.characterBible,
      style.config,
      onProgress
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
  inputSchema: generateVisualPromptsInputSchema,
};
