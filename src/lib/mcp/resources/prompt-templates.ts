/**
 * Prompt Template Resources for MCP
 * Exposes actual prompt template strings so Claude can read and use them directly
 */

import {
  AUDIO_DESIGN_PROMPT,
  CHARACTER_EXTRACTION_PROMPT,
  MOTION_PROMPT_GENERATION_PROMPT,
  SCENE_SPLITTING_PROMPT,
  VISUAL_PROMPT_GENERATION_PROMPT,
} from '@/lib/prompts';

/**
 * Get scene splitting prompt template
 */
export function getSceneSplittingPrompt(): string {
  return SCENE_SPLITTING_PROMPT;
}

/**
 * Get character extraction prompt template
 */
export function getCharacterExtractionPrompt(): string {
  return CHARACTER_EXTRACTION_PROMPT;
}

/**
 * Get visual prompt generation template
 */
export function getVisualPromptGenerationPrompt(): string {
  return VISUAL_PROMPT_GENERATION_PROMPT;
}

/**
 * Get motion prompt generation template
 */
export function getMotionPromptGenerationPrompt(): string {
  return MOTION_PROMPT_GENERATION_PROMPT;
}

/**
 * Get audio design prompt template
 */
export function getAudioDesignPrompt(): string {
  return AUDIO_DESIGN_PROMPT;
}
