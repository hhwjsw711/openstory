import { parse } from 'partial-json';
import type { Scene } from './scene-analysis.schema';

/**
 * Minimum fields required to consider a scene "complete" enough to display.
 * These are the fields from Phase 1 (scene splitting).
 */
const REQUIRED_BASIC_SCENE_FIELDS = [
  'sceneId',
  'sceneNumber',
  'originalScript',
  'metadata',
] as const;

/**
 * Minimum fields required in metadata to consider it complete.
 */
const REQUIRED_METADATA_FIELDS = ['title', 'durationSeconds'] as const;

/**
 * Minimum fields required in originalScript to consider it complete.
 */
const REQUIRED_ORIGINAL_SCRIPT_FIELDS = ['extract'] as const;

type PartialScene = Partial<Scene> & {
  sceneId?: string;
  sceneNumber?: number;
  originalScript?: Partial<Scene['originalScript']>;
  metadata?: Partial<Scene['metadata']>;
};

type ParseResult = {
  /** Complete scenes that can be displayed */
  scenes: BasicScene[];
  /** Index of the last complete scene in the array */
  lastCompleteIndex: number;
  /** Whether the entire JSON response appears complete */
  isComplete: boolean;
};

/**
 * A basic scene with the minimum fields needed for display.
 * This is what gets streamed to the client during Phase 1.
 */
export type BasicScene = {
  sceneId: string;
  sceneNumber: number;
  title: string;
  scriptExtract: string;
  durationSeconds: number;
};

/**
 * Check if a partial scene has enough data to be considered "complete" for display.
 */
function isSceneComplete(scene: PartialScene): boolean {
  // Check top-level required fields exist
  for (const field of REQUIRED_BASIC_SCENE_FIELDS) {
    if (scene[field] === undefined) return false;
  }

  // Check metadata has required fields
  if (!scene.metadata) return false;
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (scene.metadata[field] === undefined) return false;
  }

  // Check originalScript has required fields
  if (!scene.originalScript) return false;
  for (const field of REQUIRED_ORIGINAL_SCRIPT_FIELDS) {
    if (scene.originalScript[field] === undefined) return false;
  }

  return true;
}

/**
 * Convert a complete partial scene to a BasicScene for streaming.
 */
function toBasicScene(scene: PartialScene): BasicScene {
  return {
    sceneId: scene.sceneId ?? '',
    sceneNumber: scene.sceneNumber ?? 0,
    title: scene.metadata?.title ?? '',
    scriptExtract: scene.originalScript?.extract ?? '',
    durationSeconds: scene.metadata?.durationSeconds ?? 0,
  };
}

/**
 * Parse accumulated JSON text and extract complete scenes.
 * Uses partial-json to handle incomplete JSON gracefully.
 *
 * @param accumulated - The accumulated JSON text from streaming
 * @param lastCompleteIndex - The index of the last scene we've already processed (-1 if none)
 * @returns ParseResult with any new complete scenes
 *
 * @example
 * ```typescript
 * let lastIndex = -1;
 * for await (const chunk of stream) {
 *   const result = parsePartialSceneAnalysis(chunk.accumulated, lastIndex);
 *   for (let i = lastIndex + 1; i <= result.lastCompleteIndex; i++) {
 *     // Emit new scene
 *     await channel.emit('generation.scene:new', result.scenes[i]);
 *   }
 *   lastIndex = result.lastCompleteIndex;
 * }
 * ```
 */
export function parsePartialSceneAnalysis(
  accumulated: string,
  lastCompleteIndex: number
): ParseResult {
  try {
    // Parse the partial JSON
    const parsed = parse(accumulated) as unknown;

    // Handle different response formats
    let scenes: PartialScene[] = [];

    if (Array.isArray(parsed)) {
      // Direct array of scenes
      scenes = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      // Object with scenes property
      if (Array.isArray(obj.scenes)) {
        scenes = obj.scenes;
      }
    }

    // Find complete scenes
    const completeScenes: BasicScene[] = [];
    let newLastComplete = lastCompleteIndex;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (isSceneComplete(scene)) {
        completeScenes.push(toBasicScene(scene));
        if (i > newLastComplete) {
          newLastComplete = i;
        }
      }
    }

    // Check if JSON appears complete (ends with closing bracket/brace)
    const trimmed = accumulated.trim();
    const isComplete = trimmed.endsWith('}') || trimmed.endsWith(']');

    return {
      scenes: completeScenes,
      lastCompleteIndex: newLastComplete,
      isComplete,
    };
  } catch {
    // JSON not parseable yet - return empty result
    return {
      scenes: [],
      lastCompleteIndex,
      isComplete: false,
    };
  }
}

/**
 * Get only the newly complete scenes since last check.
 * Useful for emitting events for only new scenes.
 *
 * @param accumulated - The accumulated JSON text from streaming
 * @param lastCompleteIndex - The index of the last scene we've already processed
 * @returns Array of new BasicScenes and the new lastCompleteIndex
 */
export function getNewCompleteScenes(
  accumulated: string,
  lastCompleteIndex: number
): { newScenes: BasicScene[]; lastCompleteIndex: number } {
  const result = parsePartialSceneAnalysis(accumulated, lastCompleteIndex);

  // Filter to only scenes after lastCompleteIndex
  const newScenes = result.scenes.slice(lastCompleteIndex + 1);

  return {
    newScenes,
    lastCompleteIndex: result.lastCompleteIndex,
  };
}
