/**
 * Scene matching utilities
 *
 * Pure functions for matching characters and locations to scenes
 * by their continuity tags. Used by analyze-script and frame-images workflows.
 */

import type {
  CharacterMinimal,
  SequenceLocationMinimal,
} from '@/lib/db/schema';

/**
 * Match characters to a scene by their continuity tags.
 * Pure function that works in-memory without DB queries.
 */
export function matchCharactersToScene(
  allCharacters: CharacterMinimal[],
  characterTags: string[]
): CharacterMinimal[] {
  if (characterTags.length === 0) return [];

  return allCharacters.filter((char) => {
    const consistencyTag = (char.consistencyTag ?? '').toLowerCase();
    const charName = char.name.toLowerCase();
    const charId = char.characterId.toLowerCase();

    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();
      return (
        (consistencyTag && tagLower.includes(consistencyTag)) ||
        tagLower.includes(charName) ||
        tagLower.includes(charId)
      );
    });
  });
}

/**
 * Match locations to a scene by environment tag or location name.
 * Pure function that works in-memory without DB queries.
 */
export function matchLocationsToScene(
  allLocations: SequenceLocationMinimal[],
  environmentTag: string,
  sceneLocation: string
): SequenceLocationMinimal[] {
  if (!environmentTag && !sceneLocation) return [];

  const envTagLower = environmentTag.toLowerCase();
  const sceneLocLower = sceneLocation.toLowerCase();

  return allLocations.filter((loc) => {
    const consistencyTag = (loc.consistencyTag ?? '').toLowerCase();
    const locName = loc.name.toLowerCase();
    const locId = loc.locationId.toLowerCase();
    const searchTerms = [
      locName,
      locId,
      ...(consistencyTag ? [consistencyTag] : []),
    ];

    // Check if any location identifier appears in the environment tag or scene location
    return searchTerms.some(
      (term) =>
        envTagLower.includes(term) ||
        sceneLocLower.includes(term) ||
        // Reverse match: location name contains the search terms
        term.includes(envTagLower) ||
        term.includes(sceneLocLower)
    );
  });
}
