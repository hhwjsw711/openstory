/**
 * Phase 2b: Location Extraction
 *
 * Analyzes scenes to build a complete Location Bible.
 * Identifies all locations and their first appearances.
 */

import {
  callOpenRouterStream,
  type ProgressCallback,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import {
  type LocationBibleEntry,
  locationBibleEntrySchema,
} from '@/lib/ai/scene-analysis.schema';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import { z } from 'zod';
import type { Scene } from './types';

/**
 * Zod schema for validating location extraction results.
 */
export const locationExtractionResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  locationBible: z.array(locationBibleEntrySchema).catch([]),
});

/**
 * Extract location bible from scenes
 *
 * @param scenes - Scenes to analyze for locations
 * @param onProgress - Optional callback for streaming progress updates
 * @param options - Optional configuration
 * @param options.model - AI model to use (defaults to fast model)
 * @returns Location bible array
 */
export async function extractLocationBible(
  scenes: Scene[],
  onProgress?: ProgressCallback,
  options?: {
    model?: string;
  }
): Promise<LocationBibleEntry[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Fetch prompt from Langfuse (or use default if not configured)
  let systemPrompt: string;
  let prompt: Awaited<ReturnType<typeof getPrompt>>['prompt'] | undefined;

  try {
    const result = await getPrompt('velro/phase/location-extraction');
    prompt = result.prompt;
    systemPrompt = result.compiled;
  } catch {
    // Fallback to default prompt if Langfuse prompt not configured
    systemPrompt = `You are an expert script analyst and location designer for film and video production.
Your task is to analyze scripts and identify all unique locations, building a comprehensive Location Bible.

For each location:
1. Extract the location name exactly as written (e.g., "INT. OFFICE - DAY")
2. Determine if it's interior, exterior, or both
3. Identify the typical time of day
4. Provide detailed visual descriptions including:
   - Architectural style and design aesthetic
   - Key visual features that define the space
   - Color palette and dominant colors
   - Lighting characteristics
   - Mood and ambiance
5. Create a short consistency tag for image generation

Focus on visual consistency - locations should be easily recognizable across multiple scenes.
Output must be valid JSON matching the provided schema.`;
  }

  // Build user prompt with scenes
  const scenesJson = JSON.stringify(scenes, null, 2);

  const userPrompt = `Analyze the scenes within the SCENES tags and create a complete location bible.

<SCENES>
${scenesJson}
</SCENES>

For each unique location that appears:
1. Track its first appearance (scene_id, original_text, line_number)
2. Provide COMPLETE visual descriptions for visual consistency
3. Include architectural style and design details
4. Identify key visual features that define the location
5. Specify the color palette and lighting setup
6. Create a short consistency_tag for quick reference (e.g., "office_modern_steel_glass")

Notes:
- Combine variations of the same location (e.g., "INT. OFFICE - DAY" and "INT. OFFICE - NIGHT" are the same location)
- Extract the core location name without time-of-day suffixes
- Describe the location in its most commonly seen state

Respond with ONLY valid JSON matching the schema.`;

  let finalContent = '';

  // Stream the response with structured outputs
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [systemMessage(systemPrompt), userMessage(userPrompt)],
    prompt, // Link to trace (may be undefined)
    observationName: 'phase-2b-location-extraction',
    tags: ['location-extraction', 'phase-2b', 'analysis'],
    metadata: { phase: '2b', phaseName: 'Location Extraction' },
    responseSchema: locationExtractionResultSchema, // Enforce JSON schema at API level
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

  // Parse JSON directly - structured outputs guarantees valid JSON
  const validated = locationExtractionResultSchema.parse(
    JSON.parse(finalContent)
  );

  // Notify with final parsed result
  if (onProgress) {
    onProgress({
      type: 'complete',
      text: finalContent,
      parsed: validated.locationBible,
    });
  }

  // Extract and return location bible directly
  return validated.locationBible;
}
