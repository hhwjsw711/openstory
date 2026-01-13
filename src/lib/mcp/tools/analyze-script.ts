/**
 * Analyze Script Tool - MCP Integration
 * Uses existing Velro script analysis services
 */

import type { ProgressCallback } from '@/lib/ai/openrouter-client';
import type { Scene, SceneAnalysis } from '@/lib/ai/scene-analysis.schema';
import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import { generateAudioDesignForScenes } from '@/lib/script/audio-design';
import { extractCharacterBible } from '@/lib/script/character-extraction';
import { extractLocationBible } from '@/lib/script/location-extraction';
import { generateMotionPromptsForScenes } from '@/lib/script/motion-prompts';
import { splitScriptIntoScenes } from '@/lib/script/scene-splitting';
import { generateVisualPromptsForScenes } from '@/lib/script/visual-prompts';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { z } from 'zod';

type PhaseProgressCallback = (
  phase: number,
  phaseName: string,
  progress: number,
  /** The streaming text chunk from LLM (only present for chunk events) */
  chunk?: string
) => void;

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

export const analyzeScriptInputSchema = z.object({
  script: z.string(),
  style: z.enum(getAllStyleNamesTuple()),
  aspectRatio: aspectRatioSchema.optional().default('16:9'),
});

export type AnalyzeScriptInput = z.infer<typeof analyzeScriptInputSchema>;
type AnalyzeScriptOutput = SceneAnalysis;

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
  input: AnalyzeScriptInput,
  onPhaseProgress?: PhaseProgressCallback
): Promise<AnalyzeScriptOutput> {
  try {
    const style = getStyleByName(input.style);
    if (!style) {
      throw new Error(
        `Style "${input.style}" not found. Available: ${getAllStyleNames().join(', ')}`
      );
    }

    const aspectRatio = input.aspectRatio || '16:9';

    // Create progress callbacks that report to phase progress
    const createPhaseCallback = (
      phase: number,
      phaseName: string
    ): ProgressCallback => {
      return (progress) => {
        if (onPhaseProgress && progress.type === 'chunk') {
          // Estimate progress based on text length (rough approximation)
          const estimatedProgress = Math.min(progress.text.length / 1000, 0.95);
          // Forward the actual text chunk for streaming display
          onPhaseProgress(
            phase,
            phaseName,
            estimatedProgress * 100,
            progress.text
          );
        } else if (onPhaseProgress && progress.type === 'complete') {
          onPhaseProgress(phase, phaseName, 100);
        }
      };
    };

    console.log('[MCP] Phase 1: Scene Splitting');
    onPhaseProgress?.(1, 'Scene Splitting', 0);
    const { scenes: initialScenes, projectMetadata } =
      await splitScriptIntoScenes(
        input.script,
        aspectRatio,
        createPhaseCallback(1, 'Scene Splitting')
      );

    console.log('[MCP] Phase 2a: Character Extraction');
    onPhaseProgress?.(2, 'Character Extraction', 0);
    const characterBible = await extractCharacterBible(
      initialScenes,
      createPhaseCallback(2, 'Character Extraction')
    );

    console.log('[MCP] Phase 2b: Location Extraction');
    onPhaseProgress?.(2.5, 'Location Extraction', 0);
    const locationBible = await extractLocationBible(
      initialScenes,
      createPhaseCallback(2.5, 'Location Extraction')
    );

    console.log('[MCP] Phase 3: Visual Prompt Generation');
    onPhaseProgress?.(3, 'Visual Prompt Generation', 0);
    const scenesWithVisual = await generateVisualPromptsForScenes(
      initialScenes,
      aspectRatio,
      characterBible,
      style.config,
      createPhaseCallback(3, 'Visual Prompt Generation')
    );
    let scenes = mergeScenes(initialScenes, scenesWithVisual);

    console.log('[MCP] Phase 4: Motion Prompt Generation');
    onPhaseProgress?.(4, 'Motion Prompt Generation', 0);
    const scenesWithMotion = await generateMotionPromptsForScenes(
      scenes,
      createPhaseCallback(4, 'Motion Prompt Generation')
    );
    scenes = mergeScenes(scenes, scenesWithMotion);

    console.log('[MCP] Phase 5: Audio Design');
    onPhaseProgress?.(5, 'Audio Design', 0);
    const scenesWithAudio = await generateAudioDesignForScenes(
      scenes,
      createPhaseCallback(5, 'Audio Design')
    );
    scenes = mergeScenes(scenes, scenesWithAudio);

    console.log('[MCP] All phases complete');

    return {
      status: 'success',
      projectMetadata,
      characterBible,
      locationBible,
      scenes,
    };
  } catch (error) {
    console.error('[MCP Analyze Script] Error:', error);
    throw error;
  }
}

const analyzeScriptToolDescription = {
  name: 'analyze_script',
  description: `Analyze script with 5-phase workflow. Available styles: ${getAllStyleNames().join(', ')}`,
  inputSchema: analyzeScriptInputSchema,
};
