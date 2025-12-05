/**
 * Character Service
 *
 * Handles character-related business logic for sequence characters,
 * character sheet generation, and reference image prompt building.
 *
 * @module lib/services/character.service
 */

import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';
import {
  createSequenceCharactersBulk,
  getSequenceCharacters as getSequenceCharactersHelper,
  getSequenceCharactersWithSheets as getSequenceCharactersWithSheetsHelper,
  updateCharacterSheet as updateCharacterSheetHelper,
} from '@/lib/db/helpers/sequence-characters';
import type { NewSequenceCharacter, SequenceCharacter } from '@/lib/db/schema';

/**
 * Result of building a prompt with character references
 */
export type PromptWithReferences = {
  /** Enhanced prompt with character reference mapping appended */
  prompt: string;
  /** Array of character sheet URLs in order (for image_urls parameter) */
  referenceUrls: string[];
};

/**
 * Create sequence characters from a character bible
 *
 * @param sequenceId - The sequence ID
 * @param characterBible - Array of character bible entries from script analysis
 * @returns Array of created sequence characters
 */
export async function createFromBible(
  sequenceId: string,
  characterBible: CharacterBibleEntry[]
): Promise<SequenceCharacter[]> {
  if (characterBible.length === 0) {
    return [];
  }

  const newCharacters: NewSequenceCharacter[] = characterBible.map((entry) => ({
    sequenceId,
    characterId: entry.characterId,
    name: entry.name,
    metadata: entry,
    sheetStatus: 'pending' as const,
  }));

  return await createSequenceCharactersBulk(newCharacters);
}

/**
 * Get all characters for a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Array of sequence characters
 */
export async function getSequenceCharacters(
  sequenceId: string
): Promise<SequenceCharacter[]> {
  return await getSequenceCharactersHelper(sequenceId);
}

/**
 * Get characters with completed reference sheets for a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Array of sequence characters with completed sheets
 */
export async function getSequenceCharactersWithSheets(
  sequenceId: string
): Promise<SequenceCharacter[]> {
  return await getSequenceCharactersWithSheetsHelper(sequenceId);
}

/**
 * Match scene characters by continuity tags
 *
 * Matches characters from `scene.continuity.characterTags` to sequence characters.
 * Tags can be in formats like:
 * - "char_001: Jack-denim-jacket-weathered"
 * - "Jack - 35 year old detective"
 *
 * @param sequenceId - The sequence ID
 * @param characterTags - Array of character tag strings from scene continuity
 * @returns Array of matched sequence characters
 */
export async function getCharactersForScene(
  sequenceId: string,
  characterTags: string[]
): Promise<SequenceCharacter[]> {
  if (characterTags.length === 0) {
    return [];
  }

  const allCharacters = await getSequenceCharactersHelper(sequenceId);

  return allCharacters.filter((char) => {
    const metadata = char.metadata;
    const consistencyTag = metadata.consistencyTag.toLowerCase();
    const charName = char.name.toLowerCase();

    // Check each tag for a match
    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();

      // Match by consistency tag (e.g., "char_001: Jack-denim-jacket-weathered")
      if (tagLower.includes(consistencyTag)) {
        return true;
      }

      // Match by character name appearing in the tag
      if (tagLower.includes(charName)) {
        return true;
      }

      // Match by characterId (e.g., "char_001")
      if (tagLower.includes(metadata.characterId.toLowerCase())) {
        return true;
      }

      return false;
    });
  });
}

/**
 * Update character sheet image
 *
 * @param id - The sequence character ID
 * @param sheetImageUrl - The public URL of the character sheet image
 * @param sheetImagePath - The R2 storage path
 * @returns Updated sequence character
 */
export async function updateSheet(
  id: string,
  sheetImageUrl: string,
  sheetImagePath: string
): Promise<SequenceCharacter> {
  return await updateCharacterSheetHelper(id, sheetImageUrl, sheetImagePath);
}

/**
 * Build a concise character description from metadata
 *
 * @param metadata - Character bible entry
 * @returns Concise description string
 */
function buildCharacterDescription(metadata: CharacterBibleEntry): string {
  const parts: string[] = [];

  if (metadata.age) {
    parts.push(
      typeof metadata.age === 'number'
        ? `${metadata.age} years old`
        : metadata.age
    );
  }

  if (metadata.gender) {
    parts.push(metadata.gender);
  }

  // Add key physical features (first part of description)
  if (metadata.physicalDescription) {
    const physicalSummary = metadata.physicalDescription
      .split(/[.,]/)[0]
      .trim();
    if (physicalSummary.length < 60) {
      parts.push(physicalSummary);
    }
  }

  // Add key clothing (first part)
  if (metadata.standardClothing) {
    const clothingSummary = metadata.standardClothing.split(/[.,]/)[0].trim();
    if (clothingSummary.length < 60) {
      parts.push(clothingSummary);
    }
  }

  return parts.join(', ');
}

/**
 * Build prompt with multi-character reference mapping
 *
 * Enhances the base prompt with character reference information for models
 * that support multiple reference images via the `image_urls` parameter.
 *
 * @param basePrompt - The original visual prompt
 * @param characters - Array of sequence characters with completed sheets
 * @returns Enhanced prompt and array of reference URLs
 *
 * @example
 * ```ts
 * const { prompt, referenceUrls } = buildPromptWithReferences(
 *   "A tense confrontation in the dimly lit bar...",
 *   [jackCharacter, sarahCharacter]
 * );
 * // prompt now includes character reference mapping
 * // referenceUrls = [jackSheetUrl, sarahSheetUrl]
 * ```
 */
export function buildPromptWithReferences(
  basePrompt: string,
  characters: SequenceCharacter[]
): PromptWithReferences {
  // Filter to only characters with completed sheets
  const charactersWithSheets = characters.filter(
    (c) => c.sheetImageUrl && c.sheetStatus === 'completed'
  );

  if (charactersWithSheets.length === 0) {
    return {
      prompt: basePrompt,
      referenceUrls: [],
    };
  }

  // Build reference mapping
  const referenceLines = charactersWithSheets.map((char, index) => {
    const metadata = char.metadata;
    const description = buildCharacterDescription(metadata);
    return `- Image ${index + 1}: ${char.name} - ${description}`;
  });

  // Append reference section to prompt
  const enhancedPrompt = `${basePrompt}

CHARACTER REFERENCES (match to image_urls array):
${referenceLines.join('\n')}

Generate the scene with characters matching their reference images exactly.`;

  const referenceUrls = charactersWithSheets.map((c) => c.sheetImageUrl!);

  return {
    prompt: enhancedPrompt,
    referenceUrls,
  };
}

/**
 * Build a detailed character sheet prompt from character bible entry
 *
 * @param entry - The character bible entry
 * @returns Full character sheet generation prompt
 */
export function buildCharacterSheetPrompt(entry: CharacterBibleEntry): string {
  const parts = [
    `Full body character reference sheet of ${entry.name}`,
    'showing front view, 3/4 view, and side profile.',
  ];

  if (entry.age) {
    const ageStr =
      typeof entry.age === 'number' ? `${entry.age} years old` : entry.age;
    parts.push(ageStr);
  }

  if (entry.gender) {
    parts.push(`${entry.gender}.`);
  }

  if (entry.physicalDescription) {
    parts.push(entry.physicalDescription);
  }

  if (entry.standardClothing) {
    parts.push(`Wearing: ${entry.standardClothing}`);
  }

  if (entry.distinguishingFeatures) {
    parts.push(`Notable features: ${entry.distinguishingFeatures}`);
  }

  parts.push(
    'Clean white background, character design reference sheet style, consistent proportions across all views, professional quality.'
  );

  return parts.join(' ');
}

/**
 * Character service object for convenient imports
 * @deprecated Use individual function imports instead
 */
export const characterService = {
  createFromBible,
  getSequenceCharacters,
  getSequenceCharactersWithSheets,
  getCharactersForScene,
  updateSheet,
  buildPromptWithReferences,
  buildCharacterSheetPrompt,
};
