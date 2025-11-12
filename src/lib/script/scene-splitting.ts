/**
 * Phase 1: Scene Splitting
 *
 * Splits a script into basic scenes with metadata.
 * Does NOT generate prompts, characters, or audio - just identifies scene boundaries.
 */

import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import type { ProjectMetadata, Scene } from '@/lib/ai/scene-analysis.schema';
import { SCENE_SPLITTING_PROMPT } from '@/lib/prompts';
import { z } from 'zod';

/**
 * Zod schema for validating scene splitting results
 */
const sceneSplittingResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']),
  projectMetadata: z.object({
    title: z.string(),
    aspectRatio: z.string(),
    totalDurationSeconds: z.number().optional(),
    generatedAt: z.string(),
  }),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      sceneNumber: z.number(),
      originalScript: z.object({
        extract: z.string(),
        lineNumber: z.number(),
        dialogue: z
          .array(
            z.object({
              character: z.string().nullable(),
              line: z.string(),
            })
          )
          .default([]),
      }),
      metadata: z.object({
        title: z.string(),
        durationSeconds: z.number(),
        location: z.string(),
        timeOfDay: z.string(),
        storyBeat: z.string(),
      }),
    })
  ),
});

/**
 * Split a script into basic scenes with metadata
 *
 * @param script - The script content to analyze
 * @param aspectRatio - The aspect ratio for the project (e.g., '16:9', '9:16', '1:1')
 * @param model - AI model to use (defaults to fast model)
 * @returns Project metadata and basic scenes
 */
export async function splitScriptIntoScenes(
  script: string,
  aspectRatio: string,
  model: string = RECOMMENDED_MODELS.fast
): Promise<{ projectMetadata: ProjectMetadata; scenes: Scene[] }> {
  // Sanitize script content
  const sanitizedScript = sanitizeScriptContent(script);

  // Build user prompt
  const userPrompt = `Analyze the script within the USER_SCRIPT tags and split it into logical scenes using the aspect ratio specified in the ASPECT_RATIO tags.

<ASPECT_RATIO>
${aspectRatio}
</ASPECT_RATIO>

<USER_SCRIPT>
${sanitizedScript}
</USER_SCRIPT>

IMPORTANT: Extract EXACT original script text for each scene. Do NOT modify or enhance user's words.

Respond with ONLY valid JSON matching the schema.`;

  // Call AI
  const response = await callOpenRouter({
    model,
    messages: [systemMessage(SCENE_SPLITTING_PROMPT), userMessage(userPrompt)],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed =
    extractJSON<z.infer<typeof sceneSplittingResultSchema>>(content);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = sceneSplittingResultSchema.parse(parsed);

  // Extract and return project metadata and scenes
  return {
    projectMetadata: validated.projectMetadata,
    scenes: validated.scenes,
  };
}
