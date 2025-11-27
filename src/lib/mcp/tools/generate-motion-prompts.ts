/**
 * Generate Motion Prompts Tool - MCP Integration
 * Phase 4: Generates motion prompts for scenes
 */

import { sceneSchema } from '@/lib/ai/scene-analysis.schema';
import type { Scene } from '@/lib/script';
import { generateMotionPromptsForScenes } from '@/lib/script/motion-prompts';
import { z } from 'zod';

export const generateMotionPromptsInputSchema = z.object({
  scenes: z.array(sceneSchema),
});

export type GenerateMotionPromptsInput = z.infer<
  typeof generateMotionPromptsInputSchema
>;

export type GenerateMotionPromptsOutput = {
  scenes: Scene[];
};

/**
 * Generate motion prompts for scenes
 */
export async function generateMotionPromptsTool(
  input: GenerateMotionPromptsInput
): Promise<GenerateMotionPromptsOutput> {
  try {
    console.log(
      `[MCP Generate Motion Prompts] Generating motion prompts for ${input.scenes.length} scenes`
    );

    const scenes = await generateMotionPromptsForScenes(input.scenes);

    console.log(
      `[MCP Generate Motion Prompts] Complete: ${scenes.length} scenes enriched with motion prompts`
    );

    return { scenes };
  } catch (error) {
    console.error('[MCP Generate Motion Prompts] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const generateMotionPromptsToolDescription = {
  name: 'generate_motion_prompts',
  description: `Generate motion prompts for scenes (Phase 4 of script analysis).

This tool creates camera movement descriptions for video generation with:
- 3 movement style variants (B1: low energy/static, B2: medium energy, B3: high energy)
- Selected movement style based on scene's emotional needs
- Complete motion prompts (100-150 words, self-contained)
- Camera equipment, movement type, speed, smoothness
- Start/end positions, duration, technical parameters

Requires scenes with visual prompts from Phase 3. Motion prompts are self-contained for AI video generators with no memory.`,
  inputSchema: generateMotionPromptsInputSchema,
};
