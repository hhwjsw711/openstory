/**
 * Type definitions for progressive script analysis
 *
 * Progressive analysis builds up Scene data across 5 phases.
 * The Scene type has optional fields that get populated as analysis progresses.
 */

import type {
  CharacterBibleEntry,
  ProjectMetadata,
  Scene,
} from '@/lib/ai/scene-analysis.schema';

// Re-export Scene as the single source of truth for scene data
export type { Scene };

/**
 * Phase 1 Output: Scene splitting result
 * Scenes contain: sceneId, sceneNumber, originalScript, metadata
 */
export type SceneSplittingResult = {
  status: 'success' | 'error' | 'rejected';
  projectMetadata: ProjectMetadata;
  scenes: Scene[];
};

/**
 * Phase 2 Output: Character extraction result
 */
export type CharacterExtractionResult = {
  status: 'success' | 'error' | 'rejected';
  characterBible: CharacterBibleEntry[];
};

/**
 * Phase 3 Output: Visual prompt generation result
 * Adds: variants.cameraAngles, variants.moodTreatments, selectedVariant.cameraAngle,
 * selectedVariant.moodTreatment, prompts.visual, continuity
 */
export type VisualPromptGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Scene[];
};

/**
 * Phase 4 Output: Motion prompt generation result
 * Adds: variants.movementStyles, selectedVariant.movementStyle,
 * selectedVariant.rationale, prompts.motion
 */
export type MotionPromptGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Scene[];
};

/**
 * Phase 5 Output: Audio design generation result
 * Adds: audioDesign
 */
export type AudioDesignGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Scene[];
};
