import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { TalentWithSheets } from '@/lib/db/schema';

/**
 * Build prompt variables for the talent matching prompt.
 * Used by the analyze-script workflow with durableLLMCall.
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
