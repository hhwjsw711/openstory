/**
 * Analyze Script Tool - MCP Integration
 * Uses existing Velro script analysis services
 */

import type { Scene, SceneAnalysis } from '@/lib/ai/scene-analysis.schema';
import { generateAudioDesignForScenes } from '@/lib/script/audio-design';
import { extractCharacterBible } from '@/lib/script/character-extraction';
import { generateMotionPromptsForScenes } from '@/lib/script/motion-prompts';
import { splitScriptIntoScenes } from '@/lib/script/scene-splitting';
import { generateVisualPromptsForScenes } from '@/lib/script/visual-prompts';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';

export type AnalyzeScriptInput = {
  script: string;
  style: string;
  aspectRatio?: string;
};

export type AnalyzeScriptOutput = SceneAnalysis;

function getStyleByName(name: string) {
  return DEFAULT_STYLE_TEMPLATES.find(
    (style) => style.name.toLowerCase() === name.toLowerCase()
  );
}

function getAllStyleNames(): string[] {
  return DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
}

function mergeScenes(baseScenes: Scene[], updatedScenes: Scene[]): Scene[] {
  return baseScenes.map((baseScene) => {
    const updated = updatedScenes.find((s) => s.sceneId === baseScene.sceneId);
    return updated ? { ...baseScene, ...updated } : baseScene;
  });
}

export async function analyzeScriptTool(
  input: AnalyzeScriptInput
): Promise<AnalyzeScriptOutput> {
  try {
    const style = getStyleByName(input.style);
    if (!style) {
      throw new Error(
        `Style "${input.style}" not found. Available: ${getAllStyleNames().join(', ')}`
      );
    }

    const aspectRatio = input.aspectRatio || '16:9';

    console.log('[MCP] Phase 1: Scene Splitting');
    const { scenes: initialScenes, projectMetadata } =
      await splitScriptIntoScenes(input.script, aspectRatio);

    console.log('[MCP] Phase 2: Character Extraction');
    const characterBible = await extractCharacterBible(initialScenes);

    console.log('[MCP] Phase 3: Visual Prompt Generation');
    const scenesWithVisual = await generateVisualPromptsForScenes(
      initialScenes,
      characterBible,
      style.config
    );
    let scenes = mergeScenes(initialScenes, scenesWithVisual);

    console.log('[MCP] Phase 4: Motion Prompt Generation');
    const scenesWithMotion = await generateMotionPromptsForScenes(scenes);
    scenes = mergeScenes(scenes, scenesWithMotion);

    console.log('[MCP] Phase 5: Audio Design');
    const scenesWithAudio = await generateAudioDesignForScenes(scenes);
    scenes = mergeScenes(scenes, scenesWithAudio);

    console.log('[MCP] All phases complete');

    return {
      status: 'success',
      projectMetadata,
      characterBible,
      scenes,
    };
  } catch (error) {
    console.error('[MCP Analyze Script] Error:', error);
    throw error;
  }
}

export const analyzeScriptToolDescription = {
  name: 'analyze_script',
  description: `Analyze script with 5-phase workflow. Available styles: ${getAllStyleNames().join(', ')}`,
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'Script to analyze',
      },
      style: {
        type: 'string',
        description: 'Director style',
        enum: getAllStyleNames(),
      },
      aspectRatio: {
        type: 'string',
        description: 'Aspect ratio',
        enum: ['16:9', '9:16', '1:1', '21:9'],
      },
    },
    required: ['script', 'style'],
  },
};
