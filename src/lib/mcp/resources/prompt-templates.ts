/**
 * Prompt Template Resources for MCP
 * Exposes actual prompt template strings so Claude can read and use them directly
 */

import {
  AUDIO_DESIGN_PROMPT,
  CHARACTER_EXTRACTION_PROMPT,
  SCENE_SPLITTING_PROMPT,
} from '@/lib/prompts';

export {
  getMotionPromptGenerationPrompt,
  getVisualPromptGenerationPrompt,
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
 * Get audio design prompt template
 */
export function getAudioDesignPrompt(): string {
  return AUDIO_DESIGN_PROMPT;
}
