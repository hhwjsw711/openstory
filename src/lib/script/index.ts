/**
 * Progressive Script Analysis Functions
 *
 * Functional modules for phase-based script analysis.
 * Each phase is a pure function that calls AI and returns typed results.
 */

export { generateAudioDesignForScenes } from './audio-design';
export { extractCharacterBible } from './character-extraction';
export { generateMotionPromptsForScenes } from './motion-prompts';
export { splitScriptIntoScenes } from './scene-splitting';
export type {
  AudioDesignGenerationResult,
  BasicScene,
  CharacterExtractionResult,
  CompleteScene,
  MotionPromptGenerationResult,
  SceneSplittingResult,
  SceneWithMotionPrompts,
  SceneWithVisualPrompts,
  VisualPromptGenerationResult,
} from './types';
export { generateVisualPromptsForScenes } from './visual-prompts';
