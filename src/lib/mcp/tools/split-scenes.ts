/**
 * Split Scenes Tool - MCP Integration
 * Phase 1: Splits script into basic scenes with metadata
 */

import { splitScriptIntoScenes } from '@/lib/script/scene-splitting';
import type { ProjectMetadata, Scene } from '@/lib/ai/scene-analysis.schema';

export type SplitScenesInput = {
  script: string;
  aspectRatio?: string;
};

export type SplitScenesOutput = {
  projectMetadata: ProjectMetadata;
  scenes: Scene[];
};

/**
 * Split script into scenes
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
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'Script content to analyze',
      },
      aspectRatio: {
        type: 'string',
        description: 'Aspect ratio for the project',
        enum: ['16:9', '9:16', '1:1', '21:9'],
      },
    },
    required: ['script'],
  },
};
