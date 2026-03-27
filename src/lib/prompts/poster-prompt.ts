import type { StyleConfig } from '@/lib/db/schema/libraries';

const MAX_PROMPT_LENGTH = 2000;
const MAX_SCRIPT_LENGTH = 500;

/**
 * Build an image generation prompt for a sequence poster image.
 * Combines the sequence title, opening script text, and style config
 * into a single prompt suitable for fast preview image generation.
 */
export function buildPosterPrompt(
  title: string,
  script: string,
  styleConfig?: StyleConfig
): string {
  const scriptExcerpt = script.slice(0, MAX_SCRIPT_LENGTH).trim();

  const parts: string[] = [
    `A cinematic poster image for "${title}".`,
    `Opening scene: ${scriptExcerpt}`,
  ];

  if (styleConfig) {
    const styleDetails = [
      styleConfig.artStyle && `Art style: ${styleConfig.artStyle}`,
      styleConfig.mood && `Mood: ${styleConfig.mood}`,
      styleConfig.lighting && `Lighting: ${styleConfig.lighting}`,
    ].filter(Boolean);

    if (styleDetails.length > 0) {
      parts.push(styleDetails.join('. ') + '.');
    }
  }

  const prompt = parts.join(' ');

  if (prompt.length <= MAX_PROMPT_LENGTH) return prompt;
  return prompt.slice(0, MAX_PROMPT_LENGTH - 3) + '...';
}
