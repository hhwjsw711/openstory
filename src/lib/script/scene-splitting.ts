/**
 * Phase 1: Scene Splitting
 *
 * Splits a script into basic scenes with metadata.
 * Does NOT generate prompts, characters, or audio - just identifies scene boundaries.
 */

import {
  callOpenRouterStream,
  extractJSON,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import type { ProjectMetadata, Scene } from '@/lib/ai/scene-analysis.schema';
import {
  type AspectRatio,
  aspectRatioSchema,
} from '@/lib/constants/aspect-ratios';
import { SCENE_SPLITTING_PROMPT } from '@/lib/prompts';
import { z } from 'zod';

/**
 * Zod schema for validating scene splitting results
 */
const sceneSplittingResultSchema = z.looseObject({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  projectMetadata: z.looseObject({
    title: z.string().catch('Untitled'),
    aspectRatio: aspectRatioSchema.catch('16:9'),
    totalDurationSeconds: z.number().optional(),
    generatedAt: z.string().catch(''),
  }),
  scenes: z.array(
    z.looseObject({
      sceneId: z.string(), // STRICT - required for identity
      sceneNumber: z.number(), // STRICT - required for ordering
      originalScript: z.looseObject({
        extract: z.string().catch(''),
        lineNumber: z.number().catch(0),
        dialogue: z
          .array(
            z.looseObject({
              character: z.string().nullable().catch(null),
              line: z.string().catch(''),
            })
          )
          .catch([]),
      }),
      metadata: z.looseObject({
        title: z.string().catch('Untitled Scene'),
        durationSeconds: z.number().catch(3),
        location: z.string().catch(''),
        timeOfDay: z.string().catch(''),
        storyBeat: z.string().catch(''),
      }),
    })
  ),
});

/**
 * Split a script into basic scenes with metadata
 *
 * @param script - The script content to analyze
 * @param aspectRatio - The aspect ratio for the project (e.g., '16:9', '9:16', '1:1')
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Project metadata and basic scenes
 */
export async function splitScriptIntoScenes(
  script: string,
  aspectRatio: AspectRatio,
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<{ projectMetadata: ProjectMetadata; scenes: Scene[] }> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

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

  let finalContent = '';

  // Stream the response
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(SCENE_SPLITTING_PROMPT), userMessage(userPrompt)],
  })) {
    finalContent = chunk.accumulated;

    // Notify caller of progress (only 'chunk' during streaming)
    if (onProgress && !chunk.done) {
      onProgress({
        type: 'chunk',
        text: finalContent,
      });
    }

    if (chunk.done) break;
  }

  if (!finalContent) {
    throw new Error('AI response contained no content');
  }

  // Extract JSON from response
  const parsed =
    extractJSON<z.infer<typeof sceneSplittingResultSchema>>(finalContent);

  if (!parsed) {
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate with Zod
  const validated = sceneSplittingResultSchema.parse(parsed);

  // Notify with final parsed result
  if (onProgress) {
    onProgress({
      type: 'complete',
      text: finalContent,
      parsed: validated,
    });
  }

  // Extract and return project metadata and scenes
  return {
    projectMetadata: validated.projectMetadata,
    scenes: validated.scenes,
  };
}
