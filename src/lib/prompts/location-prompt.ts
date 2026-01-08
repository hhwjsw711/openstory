/**
 * Location Prompt Builder
 *
 * Handles location-related prompt building for location reference sheets
 * and reference image integration in frame generation.
 *
 * @module lib/prompts/location-prompt
 */

import type { LocationBibleEntry } from '@/lib/ai/scene-analysis.schema';
import type { LocationMinimal } from '@/lib/db/schema';
import {
  type PromptWithReferenceImages,
  type ReferenceImageDescription,
  buildReferenceImagePrompt,
} from './reference-image-prompt';

/**
 * Build a concise location description from location data
 *
 * @param location - Location with flattened fields
 * @returns Concise description string
 */
export const buildLocationDescription = (location: LocationMinimal): string => {
  const parts: string[] = [];

  if (location.description) {
    const descSummary = location.description.split(/[.,]/)[0].trim();
    if (descSummary.length < 100) {
      parts.push(descSummary);
    }
  }

  return `${location.name}${parts.length > 0 ? ` - ${parts.join(', ')}` : ''}`;
};

/**
 * Build reference images for locations
 * @param locations - Array of locations
 * @returns Array of reference images
 */
export const buildLocationReferenceImages = (
  locations: LocationMinimal[]
): ReferenceImageDescription[] => {
  return locations
    .filter((l) => l.referenceImageUrl)
    .map((l) => ({
      referenceImageUrl: l.referenceImageUrl ?? '',
      description: buildLocationDescription(l),
    }));
};

/**
 * Build prompt with location reference mapping
 *
 * Enhances the base prompt with location reference information for models
 * that support reference images via the `image_urls` parameter.
 *
 * @param basePrompt - The original visual prompt
 * @param locations - Array of sequence locations with completed reference images
 * @returns Enhanced prompt and array of reference URLs
 */
export const buildPromptWithLocationReferences = (
  basePrompt: string,
  locations: LocationMinimal[]
): PromptWithReferenceImages => {
  return buildReferenceImagePrompt(
    basePrompt,
    buildLocationReferenceImages(locations)
  );
};

/**
 * Build a location reference sheet prompt structure
 *
 * Creates a consistent prompt for generating location reference images with:
 * - Establishing shot showing the full environment
 * - Key architectural and design details
 * - Lighting and atmosphere matching the specified setup
 * - Color palette visualization
 *
 * @param entry - The location bible entry from script analysis
 * @param libraryLocationOverrides - Optional library location data for overrides
 * @returns Complete prompt string and reference URLs
 */
export const buildLocationSheetPrompt = (
  entry: LocationBibleEntry,
  libraryLocationOverrides?: {
    description?: string;
    referenceImageUrl?: string;
  }
): { prompt: string; referenceUrls: string[] } => {
  const referenceUrls: string[] = [];
  if (libraryLocationOverrides?.referenceImageUrl) {
    referenceUrls.push(libraryLocationOverrides.referenceImageUrl);
  }

  // Use override description if provided, otherwise use entry description
  const description =
    libraryLocationOverrides?.description || entry.description || '';

  // Build the prompt sections
  const typeLabel =
    entry.type === 'interior'
      ? 'Interior'
      : entry.type === 'exterior'
        ? 'Exterior'
        : 'Interior/Exterior';

  const timeOfDayLabel = entry.timeOfDay
    ? ` - ${entry.timeOfDay.toUpperCase()}`
    : '';

  // Build reference instruction if we have library images
  let referenceInstruction = '';
  if (referenceUrls.length > 0) {
    referenceInstruction = `
IMPORTANT - Reference Image:
Match the provided reference image for the overall look and feel of this location. Use it as the visual basis but ensure lighting and time of day match the specified setting.
`;
  }

  const prompt =
    `A professional establishing shot of a cinematic location, optimized for visual consistency across multiple scenes.

[LOCATION]:
${entry.name}${timeOfDayLabel}
Type: ${typeLabel}

[VISUAL DESCRIPTION]:
${description}

[ARCHITECTURAL STYLE]:
${entry.architecturalStyle || 'Not specified - derive from description'}

[KEY FEATURES]:
${entry.keyFeatures || 'Key visual elements that define this space'}

[COLOR PALETTE]:
${entry.colorPalette || 'Derive from description and mood'}

[LIGHTING]:
${entry.lightingSetup || 'Match time of day and mood'}

[ATMOSPHERE]:
${entry.ambiance || 'Derive from description and setting'}
${referenceInstruction}
[TECHNICAL SPECIFICATIONS]:
- Wide establishing shot capturing the full environment
- Cinematic composition with depth and scale
- High resolution with rich detail
- Film-like color grading matching the mood
- Focus on architectural and environmental details
- No people or characters in frame
- Capture the essence and mood of the location

Style: Cinematic location photography, film production reference.
Aspect ratio: 16:9 landscape format.`.trim();

  return { prompt, referenceUrls };
};

/**
 * Build a prompt for generating a location thumbnail/preview.
 * Used as the location's library preview image.
 */
export const buildLocationPreviewPrompt = (
  name: string,
  description?: string,
  hasReferenceImages?: boolean
): string => {
  const descSection = description ? `\nLocation notes: ${description}` : '';
  const referenceSection = hasReferenceImages
    ? `IMPORTANT: Use the provided reference images as the definitive source for this location's appearance.
Match all visual details exactly: architecture, colors, lighting, and atmosphere.`
    : `IMPORTANT: Generate a realistic location based on the name and description provided.
Create a detailed, consistent environment that matches the description.`;

  return `Cinematic establishing shot of ${name}, photorealistic, film production quality.

${referenceSection}

Requirements:
- Wide establishing shot showing the full environment
- Cinematic 16:9 composition
- Rich detail and depth
- Film-like lighting and color grading
- No people in frame
- Clear architectural/environmental features
${descSection}

Style: Cinematic location photography, film production reference.
Aspect ratio: 16:9 landscape format.`;
};
