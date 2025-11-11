/**
 * Type definitions for progressive script analysis
 *
 * These types represent partial scene data at different stages of analysis.
 */

import {
  originalScriptSchema,
  sceneMetadataSchema,
  selectedVariantSchema,
  variantsSchema,
} from '@/lib/ai/scene-analysis.schema';
import type {
  AudioDesign,
  CharacterBibleEntry,
  Continuity,
  MotionPrompt,
  ProjectMetadata,
  VisualPrompt,
} from '@/lib/ai/scene-analysis.schema';
import type { z } from 'zod';

// Infer types from Zod schemas
type OriginalScript = z.infer<typeof originalScriptSchema>;
type SceneMetadata = z.infer<typeof sceneMetadataSchema>;
type SelectedVariant = z.infer<typeof selectedVariantSchema>;
type Variants = z.infer<typeof variantsSchema>;

/**
 * Phase 1: Basic scene after splitting
 * Contains only original script and metadata, no prompts or character data
 */
export type BasicScene = {
  sceneId: string;
  sceneNumber: number;
  originalScript: OriginalScript;
  metadata: SceneMetadata;
};

/**
 * Phase 1 Output: Scene splitting result
 */
export type SceneSplittingResult = {
  status: 'success' | 'error' | 'rejected';
  projectMetadata: ProjectMetadata;
  scenes: BasicScene[];
};

/**
 * Phase 2 Output: Character extraction result
 */
export type CharacterExtractionResult = {
  status: 'success' | 'error' | 'rejected';
  characterBible: CharacterBibleEntry[];
};

/**
 * Phase 3: Scene with visual prompts added
 * Extends BasicScene with variants, selected variant, visual prompt, and continuity
 */
export type SceneWithVisualPrompts = BasicScene & {
  variants: Pick<Variants, 'cameraAngles' | 'moodTreatments'>;
  selectedVariant: Pick<SelectedVariant, 'cameraAngle' | 'moodTreatment'>;
  prompts: {
    visual: VisualPrompt;
  };
  continuity: Continuity;
};

/**
 * Phase 3 Output: Visual prompt generation result
 */
export type VisualPromptGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Array<{
    sceneId: string;
    variants: Pick<Variants, 'cameraAngles' | 'moodTreatments'>;
    selectedVariant: Pick<
      SelectedVariant,
      'cameraAngle' | 'moodTreatment' | 'rationale'
    >;
    prompts: {
      visual: VisualPrompt;
    };
    continuity: Continuity;
  }>;
};

/**
 * Phase 4: Scene with motion prompts added
 * Extends SceneWithVisualPrompts with movement variants and motion prompt
 */
export type SceneWithMotionPrompts = SceneWithVisualPrompts & {
  variants: Variants; // Now includes movementStyles
  selectedVariant: SelectedVariant; // Now includes movementStyle
  prompts: {
    visual: VisualPrompt;
    motion: MotionPrompt;
  };
};

/**
 * Phase 4 Output: Motion prompt generation result
 */
export type MotionPromptGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Array<{
    sceneId: string;
    variants: Pick<Variants, 'movementStyles'>;
    selectedVariant: Pick<SelectedVariant, 'movementStyle'>;
    prompts: {
      motion: MotionPrompt;
    };
  }>;
};

/**
 * Phase 5: Complete scene with all data
 * Extends SceneWithMotionPrompts with audio design
 */
export type CompleteScene = SceneWithMotionPrompts & {
  audioDesign: AudioDesign;
};

/**
 * Phase 5 Output: Audio design generation result
 */
export type AudioDesignGenerationResult = {
  status: 'success' | 'error' | 'rejected';
  scenes: Array<{
    sceneId: string;
    audioDesign: AudioDesign;
  }>;
};
