/**
 * Design Audio Tool - MCP Integration
 * Phase 5: Generates audio design for scenes
 */

import { sceneSchema } from '@/lib/ai/scene-analysis.schema';
import type { Scene } from '@/lib/script';
import { generateAudioDesignForScenes } from '@/lib/script/audio-design';
import { z } from 'zod';

export const designAudioInputSchema = z.object({
  scenes: z.array(sceneSchema),
});

/**
 * Generate audio design for scenes
 *
 * @param input - Tool input containing scenes
 */
export async function designAudioTool(input: {
  scenes: Scene[];
}): Promise<Scene[]> {
  try {
    console.log(
      `[MCP Design Audio] Generating audio design for ${input.scenes.length} scenes`
    );

    const enrichedScenes = await generateAudioDesignForScenes(input.scenes);

    console.log(
      `[MCP Design Audio] Complete: ${enrichedScenes.length} scenes enriched with audio design`
    );

    return enrichedScenes;
  } catch (error) {
    console.error('[MCP Design Audio] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const designAudioToolDescription = {
  name: 'design_audio',
  description: `Generate audio design for scenes (Phase 5 of script analysis).

This tool creates comprehensive audio design specifications with:
- Music: presence, style, mood, rationale
- Sound effects: type, description, timing, volume, spatial position
- Dialogue: presence and extracted lines from scenes
- Ambient: room tone and atmosphere

Requires scenes with visual and motion prompts from previous phases.`,
  inputSchema: z.object({
    scenes: z.array(sceneSchema),
  }),
};
