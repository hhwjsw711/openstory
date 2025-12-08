/**
 * Phase-Specific Prompts for Progressive Script Analysis
 *
 * These prompts replace the monolithic VELRO_UNIVERSAL_SYSTEM_PROMPT
 * with focused prompts for each phase of scene generation.
 */

export { SCENE_SPLITTING_PROMPT } from './scene-splitting';
export { CHARACTER_EXTRACTION_PROMPT } from './character-extraction';
export { getVisualPromptGenerationPrompt } from './visual-prompt-generation';
export { getMotionPromptGenerationPrompt } from './motion-prompt-generation';
export { AUDIO_DESIGN_PROMPT } from './audio-design';
