/**
 * Character Service
 *
 * Handles character-related business logic for sequence characters,
 * character sheet generation, and reference image prompt building.
 *
 * @module lib/services/character.service
 */

import type { CharacterBibleEntry } from '@/lib/ai/scene-analysis.schema';

import type { CharacterMinimal } from '@/lib/db/schema';
import {
  type PromptWithReferenceImages,
  type ReferenceImageDescription,
  buildReferenceImagePrompt,
} from './reference-image-prompt';
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

  return `${character.name}${parts.length > 0 ? ` - ${parts.join(', ')}` : ''}`;
}
/**
 * Build reference images for characters
 * @param characters - Array of characters
 * @returns Array of reference images
 * @example
 * ```ts
 * const referenceImages = buildCharacterReferenceImages([jackCharacter, sarahCharacter]);
 * // referenceImages = [jackReferenceImage, sarahReferenceImage]
 * ```
 */
export function buildCharacterReferenceImages(
  characters: CharacterMinimal[]
): ReferenceImageDescription[] {
  return characters
    .filter((c) => c.sheetImageUrl)
    .map((c) => ({
      referenceImageUrl: c.sheetImageUrl ?? '',
      description: buildCharacterDescription(c),
    }));
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
export function buildPromptWithCharacterReferences(
  basePrompt: string,
  characters: CharacterMinimal[]
): PromptWithReferenceImages {
  return buildReferenceImagePrompt(
    basePrompt,
    buildCharacterReferenceImages(characters)
  );
}

/**
 * Talent appearance data for character sheet generation
 */
type TalentOverrides = {
  /** Talent sheet metadata containing physical appearance data */
  sheetMetadata?: CharacterBibleEntry;
  /** Talent description/notes to include in prompt */
  description?: string;
  /** Talent sheet image URL to use as reference */
  sheetImageUrl?: string;
};

/**
 * Result of building a character sheet prompt
 */
type CharacterSheetPromptResult = {
  /** The generated prompt text */
  prompt: string;
  /** Array of reference image URLs (e.g., talent sheet) */
  referenceUrls: string[];
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
 * When talentOverrides is provided (during casting), the character's script-derived
 * identity is preserved, and the talent's appearance is added as supplementary
 * information for visual consistency.
 *
 * @param entry - The character bible entry from script analysis
 * @param talentOverrides - Optional talent data for casting
 * @returns Prompt and reference URLs for image generation
 */
export function buildCharacterSheetPrompt(
  entry: CharacterBibleEntry,
  talentOverrides?: TalentOverrides
): CharacterSheetPromptResult {
  const talentMeta = talentOverrides?.sheetMetadata;
  const hasTalent = !!(talentMeta || talentOverrides?.description);

  // Collect reference URLs
  const referenceUrls: string[] = [];
  if (talentOverrides?.sheetImageUrl) {
    referenceUrls.push(talentOverrides.sheetImageUrl);
  }

  // When a talent is cast, think of it like dressing an actor for a role:
  // - Physical appearance comes from the TALENT (that's who they are)
  // - Costume/wardrobe comes from the CHARACTER (that's the role)
  // - Makeup can achieve some character traits (scars, aging) but not change fundamentals

  // Physical attributes: use talent's if cast, otherwise character's
  const age = talentMeta?.age ?? entry.age;
  const gender = talentMeta?.gender ?? entry.gender;
  const ethnicity = talentMeta?.ethnicity ?? entry.ethnicity;
  const physicalDescription =
    talentMeta?.physicalDescription ?? entry.physicalDescription;

  // Costume/wardrobe: always from the character (the role they're playing)
  const standardClothing = entry.standardClothing;

  // Distinguishing features: character's features as makeup/styling notes
  // These get applied on top of the talent's natural appearance
  const characterFeatures = entry.distinguishingFeatures;

  const ageStr = age
    ? typeof age === 'number'
      ? `Age: ${age} years old`
      : `Age: ${age}`
    : '';

  const genderLine = gender ? `Gender: ${gender}` : '';
  const ethnicityLine = ethnicity ? `Ethnicity: ${ethnicity}` : '';

  // Build the makeup/styling section for character-specific features
  let makeupStylingSection = '';
  if (hasTalent && characterFeatures) {
    makeupStylingSection = `
Makeup & Styling (apply to achieve the character look):
${characterFeatures}`;
  } else if (characterFeatures) {
    makeupStylingSection = `Distinguishing Features:\n${characterFeatures}`;
  }

  // Build reference image instruction
  let referenceInstruction = '';
  if (hasTalent && referenceUrls.length > 0) {
    const talentNotes = talentOverrides?.description
      ? `\nTalent notes: ${talentOverrides.description}`
      : '';
    referenceInstruction = `

IMPORTANT - Actor Reference:
Match the provided reference image exactly for the actor's face, build, and physical features. The reference shows the talent being dressed and styled for this role. Apply the costume and any makeup/styling described above to transform them into the character.${talentNotes}`;
  }

  const prompt =
    `Character Reference Sheet, highly detailed, photorealistic, studio lighting, extreme fidelity, clean aesthetic.

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

Costume:
${standardClothing}

${makeupStylingSection}${referenceInstruction}

Stylistic & Technical Parameters:

Lighting: Soft, even, professional studio lighting from multiple sources to minimize harsh shadows and maximize visibility of form and detail, consistent across all panels.

Background: Uniform, seamless, solid neutral light-to-medium gray studio backdrop for all panels, matching the clean simplicity of a professional reference sheet.

Focus: Ultra-sharp, deep focus on the character in every panel, ensuring clarity of all features and clothing details.

Mood: Objective, detailed, and clear, characteristic of a high-end visual reference or concept art.

Composition: Ensure proper spacing and alignment between all panels to form a cohesive contact sheet.`.trim();

  return { prompt, referenceUrls };
}
