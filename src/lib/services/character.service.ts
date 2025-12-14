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
  getSequenceCharacters as getSequenceCharactersHelper,
  getSequenceCharactersWithSheets as getSequenceCharactersWithSheetsHelper,
  updateCharacterSheet as updateCharacterSheetHelper,
} from '@/lib/db/helpers/sequence-characters';
import type { SequenceCharacter } from '@/lib/db/schema';
import type { SequenceCharacterMinimal } from '../db/schema/sequence-characters';

/**
 * Result of building a prompt with character references
 */
type PromptWithReferences = {
  /** Enhanced prompt with character reference mapping appended */
  prompt: string;
  /** Array of character sheet URLs in order (for image_urls parameter) */
  referenceUrls: string[];
};

/**
 * Get all characters for a sequence
 *
 * @param sequenceId - The sequence ID
 * @returns Array of sequence characters
 */
async function getSequenceCharacters(
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
async function getSequenceCharactersWithSheets(
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
async function getCharactersForScene(
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
async function updateSheet(
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
  characters: SequenceCharacterMinimal[]
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

  const referenceUrls = charactersWithSheets
    .map((c) => c.sheetImageUrl)
    .filter((url): url is string => url !== null);

  return {
    prompt: enhancedPrompt,
    referenceUrls,
  };
}

/**
 * Build a detailed character sheet prompt from character bible entry
 *
 * Creates a comprehensive multi-panel reference sheet prompt with:
 * - Top row: Full-body turnaround (front, side, 3/4 back, rear)
 * - Middle-left: 15-portrait headshot matrix
 * - Lower-central: Posed full-body
 * - Right: Large close-up headshot
 *
 * @param entry - The character bible entry
 * @returns Full character sheet generation prompt
 */
export function buildCharacterSheetPrompt(entry: CharacterBibleEntry): string {
  const ageStr = entry.age
    ? typeof entry.age === 'number'
      ? `Age: ${entry.age} years old`
      : `Age: ${entry.age}`
    : '';

  const genderLine = entry.gender ? `Gender: ${entry.gender}` : '';
  const ethnicityLine = entry.ethnicity ? `Ethnicity: ${entry.ethnicity}` : '';

  const distinguishingSection = entry.distinguishingFeatures
    ? `Distinguishing Features:\n${entry.distinguishingFeatures}`
    : '';

  return `Character Reference Sheet, highly detailed, photorealistic, studio lighting, extreme fidelity, clean aesthetic.

Layout Directive: Create a composite image with a precise multi-panel grid layout as described:

Top Row (Full-Body Turnaround): Four distinct, full-body views of the character: full frontal, direct side profile (90-degree turn), back three-quarter view, and full rear view (180-degree turn). All in a neutral, standing posture.

Middle-Left Grid (Headshot Matrix): A grid of 15 distinct head-and-shoulders portraits (3 rows of 5 images). Each portrait must capture a unique head angle and subtle expression variation, systematically rotating through: direct frontal, three-quarter left/right, near-profile left/right, slight head tilts. Maintain a generally neutral to contemplative expression range.

Lower-Central Panel (Posed Full-Body): A single full-body image of the character in a three-quarter stance, head slightly turned away from the camera, conveying a dynamic or pensive mood.

Right-Side Feature Panel (Large Headshot): A single, prominent, large close-up headshot, tightly framed for maximum facial detail, focused on the character's eyes and central features.

Character Identity Directive:
Create a character with the following attributes. Maintain absolute consistency across all panels:

Name: ${entry.name}
${[ageStr, genderLine, ethnicityLine].filter(Boolean).join('\n')}

Physical Appearance:
${entry.physicalDescription}

Attire:
${entry.standardClothing}

${distinguishingSection}

Stylistic & Technical Parameters:

Lighting: Soft, even, professional studio lighting from multiple sources to minimize harsh shadows and maximize visibility of form and detail, consistent across all panels.

Background: Uniform, seamless, solid neutral light-to-medium gray studio backdrop for all panels, matching the clean simplicity of a professional reference sheet.

Focus: Ultra-sharp, deep focus on the character in every panel, ensuring clarity of all features and clothing details.

Mood: Objective, detailed, and clear, characteristic of a high-end visual reference or concept art.

Composition: Ensure proper spacing and alignment between all panels to form a cohesive contact sheet.`.trim();
}
