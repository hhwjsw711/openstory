import { z } from 'zod';

/**
 * Schema for AI-generated music prompt output
 * Used by durableLLMCall in the music workflow
 */
export const musicPromptSchema = z.object({
  tags: z
    .string()
    .describe('Comma-separated genre/style tags for ACE-Step (20-50 words)'),
  prompt: z
    .string()
    .describe('Descriptive music prompt as fallback for non-tag models'),
});

export type MusicPromptResult = z.infer<typeof musicPromptSchema>;

/**
 * Ensure tags include "instrumental" to prevent ACE-Step from generating vocals.
 */
export function reinforceInstrumentalTags(tags: string): string {
  if (tags.includes('instrumental')) return tags;
  return `${tags}, instrumental, no vocals`;
}
