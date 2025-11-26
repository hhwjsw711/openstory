/**
 * Design Audio Tool - MCP Integration
 * Phase 5: Generates audio design for scenes
 */

import { generateAudioDesignForScenes } from '@/lib/script/audio-design';
import type { Scene } from '@/lib/script';

export type DesignAudioInput = {
  scenes: Scene[];
};

export type DesignAudioOutput = {
  scenes: Scene[];
};

/**
 * Generate audio design for scenes
 */
export async function designAudioTool(
  input: DesignAudioInput
): Promise<DesignAudioOutput> {
  try {
    console.log(
      `[MCP Design Audio] Generating audio design for ${input.scenes.length} scenes`
    );

    const scenes = await generateAudioDesignForScenes(input.scenes);

    console.log(
      `[MCP Design Audio] Complete: ${scenes.length} scenes enriched with audio design`
    );

    return { scenes };
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
  inputSchema: {
    type: 'object',
    properties: {
      scenes: {
        type: 'array',
        description:
          'Array of scenes with visual and motion prompts (from generate_motion_prompts output)',
        items: {
          type: 'object',
        },
      },
    },
    required: ['scenes'],
  },
};
