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
import type { Character, CharacterMinimal } from '@/lib/db/schema';

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
async function getSequenceCharacters(sequenceId: string): Promise<Character[]> {
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
): Promise<Character[]> {
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
): Promise<Character[]> {
  if (characterTags.length === 0) {
    return [];
  }

  const allCharacters = await getSequenceCharactersHelper(sequenceId);

  return allCharacters.filter((char) => {
    const consistencyTag = (char.consistencyTag ?? '').toLowerCase();
    const charName = char.name.toLowerCase();

    // Check each tag for a match
    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();

      // Match by consistency tag (e.g., "char_001: Jack-denim-jacket-weathered")
      if (consistencyTag && tagLower.includes(consistencyTag)) {
        return true;
      }

      // Match by character name appearing in the tag
      if (tagLower.includes(charName)) {
        return true;
      }

      // Match by characterId (e.g., "char_001")
      if (tagLower.includes(char.characterId.toLowerCase())) {
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
): Promise<Character> {
  return await updateCharacterSheetHelper(id, sheetImageUrl, sheetImagePath);
}

/**
 * Build a concise character description from character data
 *
 * @param character - Character with flattened fields
 * @returns Concise description string
 */
function buildCharacterDescription(character: CharacterMinimal): string {
  const parts: string[] = [];

  if (character.physicalDescription) {
    const physicalSummary = character.physicalDescription
      .split(/[.,]/)[0]
      .trim();
    if (physicalSummary.length < 80) {
      parts.push(physicalSummary);
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
  characters: CharacterMinimal[]
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
    const description = buildCharacterDescription(char);
    return `- Image ${index + 1}: ${char.name}${description ? ` - ${description}` : ''}`;
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
 * Talent appearance overrides for character sheet generation
 */
type TalentOverrides = {
  /** Talent sheet metadata containing physical appearance data */
  sheetMetadata?: CharacterBibleEntry;
  /** Talent description to append to physical appearance */
  description?: string;
};

/**
 * Build a detailed character sheet prompt from character bible entry
 *
 * Creates a comprehensive multi-panel reference sheet prompt with:
 * - Top row: Full-body turnaround (front, side, 3/4 back, rear)
 * - Middle-left: 15-portrait headshot matrix
 * - Lower-central: Posed full-body
 * - Right: Large close-up headshot
 *
 * When talentOverrides is provided (during recasting), the script's character
 * identity (name, role) is preserved, but physical appearance is taken from
 * the talent's sheet metadata.
 *
 * @param entry - The character bible entry from script analysis
 * @param talentOverrides - Optional talent data for recasting
 * @returns Full character sheet generation prompt
 */
export function buildCharacterSheetPrompt(
  entry: CharacterBibleEntry,
  talentOverrides?: TalentOverrides
): string {
  // When recasting with talent data, use talent's appearance but keep script's character identity
  const talentMeta = talentOverrides?.sheetMetadata;

  // Physical appearance: prefer talent data when available
  const age = talentMeta?.age ?? entry.age;
  const gender = talentMeta?.gender ?? entry.gender;
  const ethnicity = talentMeta?.ethnicity ?? entry.ethnicity;

  // Build physical description, combining talent appearance with any talent description
  let physicalDescription =
    talentMeta?.physicalDescription ?? entry.physicalDescription;
  if (talentOverrides?.description) {
    physicalDescription = `${physicalDescription}\n\nTalent Reference: ${talentOverrides.description}`;
  }

  const standardClothing =
    talentMeta?.standardClothing ?? entry.standardClothing;
  const distinguishingFeatures =
    talentMeta?.distinguishingFeatures ?? entry.distinguishingFeatures;

  const ageStr = age
    ? typeof age === 'number'
      ? `Age: ${age} years old`
      : `Age: ${age}`
    : '';

  const genderLine = gender ? `Gender: ${gender}` : '';
  const ethnicityLine = ethnicity ? `Ethnicity: ${ethnicity}` : '';

  const distinguishingSection = distinguishingFeatures
    ? `Distinguishing Features:\n${distinguishingFeatures}`
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
${physicalDescription}

Attire:
${standardClothing}

${distinguishingSection}

Stylistic & Technical Parameters:

Lighting: Soft, even, professional studio lighting from multiple sources to minimize harsh shadows and maximize visibility of form and detail, consistent across all panels.

Background: Uniform, seamless, solid neutral light-to-medium gray studio backdrop for all panels, matching the clean simplicity of a professional reference sheet.

Focus: Ultra-sharp, deep focus on the character in every panel, ensuring clarity of all features and clothing details.

Mood: Objective, detailed, and clear, characteristic of a high-end visual reference or concept art.

Composition: Ensure proper spacing and alignment between all panels to form a cohesive contact sheet.`.trim();
}
