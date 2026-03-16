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
export const buildCharacterDescription = (
  character: CharacterMinimal
): string => {
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
};
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
export const buildCharacterReferenceImages = (
  characters: CharacterMinimal[]
): ReferenceImageDescription[] => {
  return characters
    .filter((c) => c.sheetImageUrl)
    .map((c) => ({
      referenceImageUrl: c.sheetImageUrl ?? '',
      description: buildCharacterDescription(c),
      role: 'character' as const,
    }));
};

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
export const buildPromptWithCharacterReferences = (
  basePrompt: string,
  characters: CharacterMinimal[]
): PromptWithReferenceImages => {
  return buildReferenceImagePrompt(
    basePrompt,
    buildCharacterReferenceImages(characters)
  );
};

/**
 * Build the base 4-panel reference sheet prompt structure
 *
 * Creates a consistent prompt with:
 * - 4-panel horizontal layout (frontal, portrait, side, rear)
 * - Studio environment (white cyclorama)
 * - Commercial photography specs
 * - High-key lighting
 * - Hyper-accurate materiality
 *
 * @param identitySection - The identity section of the prompt
 * @param additionalInstructions - Optional additional instructions (e.g., reference image handling)
 * @returns Complete prompt string
 */
export const buildBaseSheetPrompt = (
  identitySection: string,
  /** Optional additional instructions (e.g., reference image handling) */
  additionalInstructions: string = ''
): string => {
  return `A professional four-panel photographic character reference grid, maintaining absolute anatomical and stylistic consistency.

[LAYOUT]:
The grid comprises four distinct, technical views arranged horizontally:
- Panel 1 (Left): Full body frontal view, standing in a neutral pose
- Panel 2 (Center-Left): Close-up portrait frontal view (chest up)
- Panel 3 (Center-Right): Full body side profile view facing left
- Panel 4 (Right): Full body rear view

All attire, accessories, hair, and features must be perfectly consistent across all four panels.

${identitySection}
${additionalInstructions}
[ENVIRONMENT]:
Seamless, minimalist commercial photo studio cyclorama with flat neutral white background. Clean, sterile, analytical atmosphere designed for clarity.

[OPTICAL & CAMERA SPECS]:
Commercial reference photography style. High-resolution medium format digital, tack-sharp focus across all panels, deep depth of field. Flat perspective, no lens distortion.

[LIGHTING]:
Neutral, even, high-key studio lighting. Diffused illumination from large softboxes to eliminate harsh shadows and highlight shape and form evenly. 5500K daylight balance.

[MATERIALITY]:
Hyper-accurate rendering of all fabrics, skin textures, hardware, and micro-details. Consistent texture rendering across all four angles without beautification or alteration.`.trim();
};

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
 * Creates a 4-panel horizontal reference grid:
 * - Panel 1: Full body frontal view
 * - Panel 2: Close-up portrait (chest up)
 * - Panel 3: Full body side profile (left)
 * - Panel 4: Full body rear view
 *
 * When talentOverrides is provided (during casting), the character's script-derived
 * identity is preserved, and the talent's appearance is added as supplementary
 * information for visual consistency.
 *
 * @param entry - The character bible entry from script analysis
 * @param talentOverrides - Optional talent data for casting
 * @returns Prompt and reference URLs for image generation
 */
export const buildCharacterSheetPrompt = (
  entry: CharacterBibleEntry,
  talentOverrides?: TalentOverrides
): CharacterSheetPromptResult => {
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

  const ageStr = age ? `Age: ${age}` : '';

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
Match the provided reference image exactly for the actor's face, build, and physical features. The reference shows the talent in neutral attire - dress them in the costume described above and apply any makeup/styling to transform them into the character.${talentNotes}
`;
  }

  // Build identity section
  const identitySection = `[CHARACTER IDENTITY]:
Name: ${entry.name}
${[ageStr, genderLine, ethnicityLine].filter(Boolean).join('\n')}

Physical Appearance:
${physicalDescription}

Costume:
${standardClothing}

${makeupStylingSection}`.trim();

  const prompt = buildBaseSheetPrompt(identitySection, referenceInstruction);

  return { prompt, referenceUrls };
};

/**
 * Build a detailed talent sheet prompt that uses reference images as the source of truth.
 * Uses the shared 4-panel horizontal layout from buildBaseSheetPrompt.
 */
export const buildLibraryTalentSheetPrompt = (
  name: string,
  description?: string,
  hasReferenceImages?: boolean
): string => {
  const descSection = description ? `\nUser Description:\n${description}` : '';

  const referenceInstruction = hasReferenceImages
    ? `IMPORTANT: Use the provided reference images as the definitive source for this person's appearance.
Match all physical details exactly: age, build, skin tone, hair color/style, facial features, and clothing.
`
    : `IMPORTANT: Generate a consistent character based on the name and description provided.
Create a realistic, detailed appearance that matches the description.
`;

  const appearanceSection = hasReferenceImages
    ? `DERIVE ALL DETAILS FROM THE REFERENCE IMAGES PROVIDED. Match the person's exact appearance.`
    : `Use the name and description to create a detailed, consistent appearance. Ensure all panels show the same person with matching physical features, clothing, and distinguishing characteristics.`;

  const consistencyNote = hasReferenceImages
    ? `\nMaintain absolute consistency with reference images across all panels.`
    : `\nMaintain absolute consistency across all panels - the same person must appear in every view with matching features.`;

  const identitySection = `[PERSON IDENTITY]:
Name: ${name}
${descSection}

Physical Appearance, Attire, and Distinguishing Features:
${appearanceSection}
${consistencyNote}`.trim();

  return buildBaseSheetPrompt(identitySection, referenceInstruction);
};

/**
 * Build a prompt for generating a talent headshot/avatar.
 * Used as the talent's profile image.
 */
export const buildTalentHeadshotPrompt = (
  name: string,
  description?: string,
  hasReferenceImages?: boolean
): string => {
  const descSection = description ? `\nPerson notes: ${description}` : '';
  const referenceSection = hasReferenceImages
    ? `IMPORTANT: Use the provided reference images as the definitive source for this person's appearance.
Match all physical details exactly: face shape, skin tone, hair color/style, eye color, and any distinguishing features.`
    : `IMPORTANT: Generate a realistic portrait based on the name and description provided.
Create a detailed, consistent appearance that matches the description.`;

  const consistencyNote = hasReferenceImages
    ? `Maintain absolute consistency with reference images.`
    : `Ensure the portrait matches the description and is consistent with the character reference sheet.`;

  return `Professional headshot portrait of ${name}, photorealistic, studio lighting.

${referenceSection}

Requirements:
- Head and shoulders portrait, centered composition
- Neutral to friendly expression
- Direct eye contact with camera
- Soft, even professional studio lighting
- Clean, solid neutral background
- Sharp focus on face and eyes
- High detail on facial features
${descSection}

Style: Professional portrait photography, headshot for actor/model portfolio.
Aspect ratio: Square 1:1 format.
${consistencyNote}`;
};
