/**
 * Location Matching Service
 *
 * Uses AI to match suggested library locations to extracted location entries
 * based on name, description, and visual characteristics.
 */

import type { TextModel } from '@/lib/ai/models';
import { callLLMStream, RECOMMENDED_MODELS } from '@/lib/ai/llm-client';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import type { LocationBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { LibraryLocation } from '@/lib/db/schema';
import type { LibraryLocationMatch } from '@/lib/workflow/types';
import { z } from 'zod';

/**
 * Schema for AI matching response
 */
export const locationMatchResponseSchema = z.object({
  matches: z.array(
    z.object({
      locationId: z.string(),
      libraryLocationId: z.string(),
      confidence: z.number(), // 0-1 range enforced by prompt
      reason: z.string(),
    })
  ),
});

/**
 * Build prompt variables for the matching prompt
 */
export function buildLocationMatchingPromptVariables(
  locations: LocationBibleEntry[],
  libraryLocations: LibraryLocation[]
) {
  const locationsDescription = locations
    .map(
      (loc) => `- Location ID: ${loc.locationId}
  Name: ${loc.name}
  Type: ${loc.type ?? 'unspecified'}
  Time of Day: ${loc.timeOfDay ?? 'unspecified'}
  Description: ${loc.description ?? 'no description'}
  Architectural Style: ${loc.architecturalStyle ?? 'unspecified'}
  Key Features: ${loc.keyFeatures ?? 'none specified'}
  Ambiance: ${loc.ambiance ?? 'unspecified'}`
    )
    .join('\n\n');

  const libraryDescription = libraryLocations
    .map(
      (lib) => `- Library Location ID: ${lib.id}
  Name: ${lib.name}
  Description: ${lib.description ?? 'no description'}
  Has Reference Image: ${lib.referenceImageUrl ? 'yes' : 'no'}`
    )
    .join('\n\n');

  const numLibrary = libraryLocations.length;
  const numLocations = locations.length;
  const expectedMatches = Math.min(numLibrary, numLocations);

  return {
    locationsDescription,
    libraryDescription,
    numLibrary: `${numLibrary}`,
    numLocations: `${numLocations}`,
    expectedMatches: `${expectedMatches}`,
    additionalRequirements:
      numLibrary > numLocations
        ? `- Note: More library locations than extracted locations. Match the ${numLocations} best fits.`
        : numLibrary < numLocations
          ? `- Note: More extracted locations than library locations. Some locations will remain unmatched.`
          : '',
  };
}

/**
 * Build the user prompt for matching
 */
export function buildLocationMatchingPrompt(
  locations: LocationBibleEntry[],
  libraryLocations: LibraryLocation[]
): string {
  const {
    locationsDescription,
    libraryDescription,
    expectedMatches,
    numLibrary,
    numLocations,
    additionalRequirements,
  } = buildLocationMatchingPromptVariables(locations, libraryLocations);

  return `Match the following library locations to extracted script locations. The user specifically selected these ${numLibrary} library locations for visual consistency.

EXTRACTED LOCATIONS FROM SCRIPT (${numLocations} total):
${locationsDescription}

LIBRARY LOCATIONS TO MATCH (${numLibrary} selected by user):
${libraryDescription}

REQUIREMENTS:
- Match library locations to script locations based on semantic similarity (name, description, type)
- Each library location can only match ONE script location
- Each script location can only have ONE library location match
- Only match if there's reasonable similarity (confidence > 0.5)
- Consider: location type (interior/exterior), setting, atmosphere, visual characteristics
${additionalRequirements}

MATCHING RULES:
- "INT. OFFICE" should match library locations like "Corporate Office", "Modern Office", etc.
- "EXT. PARK" should match "City Park", "Garden", etc.
- Consider architectural style and ambiance when matching
- If no good match exists, don't force a match

Respond with up to ${expectedMatches} matches, only including high-confidence matches.`;
}

/**
 * Match suggested library locations to extracted locations using AI
 *
 * @param locations - Location bible entries from script analysis
 * @param libraryLocations - Library locations selected by user
 * @param options - Configuration options
 * @returns Match results
 */
export async function matchLocationsToLibrary(
  locations: LocationBibleEntry[],
  libraryLocations: LibraryLocation[],
  options?: { model?: TextModel }
): Promise<LibraryLocationMatch[]> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Filter library locations that have reference images (usable for matching)
  const libraryWithImages = libraryLocations.filter(
    (lib) => lib.referenceImageUrl
  );

  // If no usable library locations or extracted locations, return empty
  if (libraryWithImages.length === 0 || locations.length === 0) {
    console.log(
      '[LocationMatching] No usable library locations or no extracted locations'
    );
    return [];
  }

  // Fetch prompt (Langfuse if enabled, otherwise local fallback)
  const { prompt, compiled: systemPromptText } = await getPrompt(
    'velro/phase/location-matching'
  );

  let finalContent = '';

  // Stream the response with structured outputs
  for await (const chunk of callLLMStream({
    model,
    messages: [
      { role: 'system' as const, content: systemPromptText },
      {
        role: 'user' as const,
        content: buildLocationMatchingPrompt(locations, libraryWithImages),
      },
    ],
    prompt, // Link to Langfuse trace if available
    observationName: 'location-matching',
    tags: ['location-matching', 'analysis'],
    metadata: {
      locationCount: locations.length,
      libraryLocationCount: libraryWithImages.length,
    },
    responseSchema: locationMatchResponseSchema,
  })) {
    finalContent = chunk.accumulated;
    if (chunk.done) break;
  }

  // Parse and validate response
  let aiMatches: z.infer<typeof locationMatchResponseSchema>['matches'] = [];

  if (finalContent) {
    const validated = locationMatchResponseSchema.safeParse(
      JSON.parse(finalContent)
    );
    if (validated.success) {
      aiMatches = validated.data.matches;
    } else {
      console.error(
        '[LocationMatching] Validation failed:',
        validated.error.message
      );
    }
  }

  console.log('[LocationMatching] AI matches count:', aiMatches.length);

  // Build match results with full library location data
  const usedLibraryIds = new Set<string>();
  const usedLocationIds = new Set<string>();
  const matches: LibraryLocationMatch[] = [];

  for (const match of aiMatches) {
    // Skip if library location already used
    if (usedLibraryIds.has(match.libraryLocationId)) continue;
    // Skip if script location already matched
    if (usedLocationIds.has(match.locationId)) continue;
    // Skip low confidence matches
    if (match.confidence < 0.5) continue;

    // Find the library location
    const libraryLoc = libraryWithImages.find(
      (lib) => lib.id === match.libraryLocationId
    );
    if (!libraryLoc?.referenceImageUrl) continue;

    // Verify location exists
    const location = locations.find(
      (loc) => loc.locationId === match.locationId
    );
    if (!location) continue;

    usedLibraryIds.add(match.libraryLocationId);
    usedLocationIds.add(match.locationId);
    matches.push({
      locationId: match.locationId,
      libraryLocationId: match.libraryLocationId,
      libraryLocationName: libraryLoc.name,
      referenceImageUrl: libraryLoc.referenceImageUrl,
      description: libraryLoc.description ?? undefined,
    });
  }

  console.log('[LocationMatching] Final matches:', matches.length);

  return matches;
}
