/**
 * Split Scenes Tool - MCP Integration
 * Phase 1: Splits script into basic scenes with metadata
 */

import type { ProjectMetadata, Scene } from '@/lib/ai/scene-analysis.schema';
import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import { splitScriptIntoScenes } from '@/lib/script/scene-splitting';
import { z } from 'zod';

export const splitScenesInputSchema = z.object({
  script: z.string(),
  aspectRatio: aspectRatioSchema,
});

export type SplitScenesInput = z.infer<typeof splitScenesInputSchema>;

export type SplitScenesOutput = {
  projectMetadata: ProjectMetadata;
  scenes: Scene[];
};

/**
 * Split script into scenes
 *
 * @param input - Tool input containing script and aspect ratio
 */
export async function splitScenesTool(
  input: SplitScenesInput
): Promise<SplitScenesOutput> {
  try {
    const aspectRatio = input.aspectRatio || '16:9';

    console.log('[MCP Split Scenes] Splitting script into scenes');

    const result = await splitScriptIntoScenes(input.script, aspectRatio);

    console.log(
      `[MCP Split Scenes] Complete: ${result.scenes.length} scenes created`
    );

    return result;
  } catch (error) {
    console.error('[MCP Split Scenes] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const splitScenesToolDescription = {
  name: 'split_scenes',
  description: `Split a script into logical scenes with metadata (Phase 1 of script analysis).

This tool analyzes a script and breaks it into scenes with:
- Scene IDs and numbers
- Titles, locations, time of day
- Story beats
- Duration estimates
- Original script extracts (preserved verbatim)

Returns project metadata and an array of basic scenes (without prompts, characters, or audio design yet).`,
  inputSchema: splitScenesInputSchema,
};
