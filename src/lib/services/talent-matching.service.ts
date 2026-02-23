/**
 * Talent Matching Service
 *
 * Uses AI to match suggested talent to extracted character roles
 * based on physical descriptions, age, gender, and appearance.
 */

import type { TextModel } from '@/lib/ai/models';
import {
  callOpenRouterStream,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from '@/lib/ai/openrouter-client';
import { getPrompt } from '@/lib/observability/langfuse-prompts';
import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { TalentWithSheets } from '@/lib/db/schema';
import type {
  TalentCharacterMatch,
  TalentMatchResult,
} from '@/lib/workflow/types';
import { z } from 'zod';

/**
 * Schema for AI matching response
 */
export const talentMatchResponseSchema = z.object({
  matches: z.array(
    z.object({
      characterId: z.string(),
      talentId: z.string(),
      confidence: z.number(), // 0-1 range enforced by prompt, not schema (Anthropic doesn't support min/max)
      reason: z.string(),
    })
  ),
});

/**
 * Build the user prompt for matching
 */
export function buildMatchingPromptVariables(
  characters: CharacterBibleEntry[],
  talentList: TalentWithSheets[]
) {
  const charactersDescription = characters
    .map(
      (c) => `- Character ID: ${c.characterId}
  Name: ${c.name}
  Age: ${c.age ?? 'unspecified'}
  Gender: ${c.gender ?? 'unspecified'}
  Ethnicity: ${c.ethnicity ?? 'unspecified'}
  Physical: ${c.physicalDescription ?? 'no description'}`
    )
    .join('\n\n');

  const talentDescription = talentList
    .map((t) => {
      const metadata = t.defaultSheet?.metadata;
      // Use metadata if available, otherwise use basic talent info
      // For famous actors, their name alone is enough for the AI to know them
      return `- Talent ID: ${t.id}
  Name: ${t.name}
  Age: ${metadata?.age ?? 'unspecified (infer from name if recognizable)'}
  Gender: ${metadata?.gender ?? 'unspecified (infer from name if recognizable)'}
  Ethnicity: ${metadata?.ethnicity ?? 'unspecified'}
  Physical/Description: ${metadata?.physicalDescription ?? t.description ?? `${t.name} (use your knowledge of this person)`}`;
    })
    .join('\n\n');

  const numTalent = talentList.length;
  const numCharacters = characters.length;
  const expectedMatches = Math.min(numTalent, numCharacters);

  return {
    charactersDescription,
    talentDescription,
    numTalent: `${numTalent}`,
    numCharacters: `${numCharacters}`,
    expectedMatches: `${expectedMatches}`,
    additionalRequirements:
      numTalent > numCharacters
        ? `- Note: More talent than characters. Match the ${numCharacters} best fits.`
        : '',
  };
}

/**
 * Build the user prompt for matching
 */
export function buildMatchingPrompt(
  characters: CharacterBibleEntry[],
  talentList: TalentWithSheets[]
): string {
  const {
    charactersDescription,
    talentDescription,
    expectedMatches,
    numTalent,
    numCharacters,
    additionalRequirements,
  } = buildMatchingPromptVariables(characters, talentList);

  return `Cast the following talent into character roles. The user specifically selected these ${numTalent} talent members.

CHARACTERS (${numCharacters} available):
${charactersDescription}

TALENT TO CAST (${numTalent} selected by user):
${talentDescription}

REQUIREMENTS:
- Match ALL ${expectedMatches} talent to characters (${numTalent} talent, ${numCharacters} characters available)
- Each talent gets exactly one character
- Each character can only have one talent
${additionalRequirements}

Respond with exactly ${expectedMatches} matches.`;
}

/**
 * Match suggested talent to extracted characters using AI
 *
 * @param characters - Character bible entries from script analysis
 * @param talentList - Talent with their default sheets
 * @param options - Configuration options
 * @returns Match results with unused talent
 */
export async function matchTalentToCharacters(
  characters: CharacterBibleEntry[],
  talentList: TalentWithSheets[],
  options?: { model?: TextModel }
): Promise<TalentMatchResult> {
  const { model = RECOMMENDED_MODELS.fast } = options ?? {};

  // Filter talent that have at least a default sheet with an image
  // Note: metadata is optional - we can match based on name/description alone
  const talentWithData = talentList.filter((t) => t.defaultSheet?.imageUrl);

  // If no usable talent or characters, return empty result
  if (talentWithData.length === 0 || characters.length === 0) {
    // If there are talent without sheets, still report them as unused
    const unusedNoSheet = talentList.filter((t) => !t.defaultSheet?.imageUrl);
    return {
      matches: [],
      unusedTalentIds: unusedNoSheet.map((t) => t.id),
      unusedTalentNames: unusedNoSheet.map((t) => t.name),
    };
  }

  // Fetch prompt from Langfuse
  const { prompt, compiled } = await getPrompt('velro/phase/talent-matching');

  let finalContent = '';

  // Stream the response with structured outputs
  for await (const chunk of callOpenRouterStream({
    model,
    messages: [
      systemMessage(compiled),
      userMessage(buildMatchingPrompt(characters, talentWithData)),
    ],
    prompt, // Link to Langfuse trace
    observationName: 'talent-matching',
    tags: ['talent-matching', 'casting', 'analysis'],
    metadata: {
      characterCount: characters.length,
      talentCount: talentWithData.length,
    },
    responseSchema: talentMatchResponseSchema, // Enforce JSON schema at API level
  })) {
    finalContent = chunk.accumulated;
    if (chunk.done) break;
  }

  // Parse and validate response - structured outputs guarantees valid JSON
  let aiMatches: z.infer<typeof talentMatchResponseSchema>['matches'] = [];

  if (finalContent) {
    const validated = talentMatchResponseSchema.safeParse(
      JSON.parse(finalContent)
    );
    if (validated.success) {
      aiMatches = validated.data.matches;
    } else {
      console.error(
        '[TalentMatching] Validation failed:',
        validated.error.message
      );
    }
  }

  console.log('[TalentMatching] AI matches count:', aiMatches.length);

  // Build match results with full talent data
  const usedTalentIds = new Set<string>();
  const usedCharacterIds = new Set<string>();
  const matches: TalentCharacterMatch[] = [];

  // First pass: process AI matches
  for (const match of aiMatches) {
    // Skip if talent already used
    if (usedTalentIds.has(match.talentId)) continue;
    // Skip if character already assigned
    if (usedCharacterIds.has(match.characterId)) continue;

    // Find the talent
    const talent = talentWithData.find((t) => t.id === match.talentId);
    if (!talent || !talent.defaultSheet?.imageUrl) continue;

    // Verify character exists
    const character = characters.find(
      (c) => c.characterId === match.characterId
    );
    if (!character) continue;

    usedTalentIds.add(match.talentId);
    usedCharacterIds.add(match.characterId);
    matches.push({
      characterId: match.characterId,
      talentId: match.talentId,
      talentName: talent.name,
      sheetImageUrl: talent.defaultSheet.imageUrl,
      sheetMetadata: talent.defaultSheet.metadata ?? undefined,
    });
  }

  // Second pass: force-assign any unmatched talent to remaining characters
  // (in case AI missed some - user explicitly selected these talent)
  const unmatchedTalent = talentWithData.filter(
    (t) => !usedTalentIds.has(t.id)
  );
  const availableCharacters = characters.filter(
    (c) => !usedCharacterIds.has(c.characterId)
  );

  for (const talent of unmatchedTalent) {
    if (availableCharacters.length === 0) break;
    if (!talent.defaultSheet?.imageUrl) continue;

    const character = availableCharacters.shift() ?? null;
    if (!character) continue;
    usedTalentIds.add(talent.id);
    usedCharacterIds.add(character.characterId);
    matches.push({
      characterId: character.characterId,
      talentId: talent.id,
      talentName: talent.name,
      sheetImageUrl: talent.defaultSheet.imageUrl,
      sheetMetadata: talent.defaultSheet.metadata ?? undefined,
    });
  }

  // Only unused if more talent than characters
  const unusedTalent = talentList.filter((t) => !usedTalentIds.has(t.id));

  return {
    matches,
    unusedTalentIds: unusedTalent.map((t) => t.id),
    unusedTalentNames: unusedTalent.map((t) => t.name),
  };
}
