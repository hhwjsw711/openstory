/**
 * Result of building a prompt with character references
 */
export type PromptWithReferenceImages = {
  /** Enhanced prompt with character reference mapping appended */
  prompt: string;
  /** Array of character sheet URLs in order (for image_urls parameter) */
  referenceUrls: string[];
};

export type ReferenceImageDescription = {
  referenceImageUrl: string;
  description: string;
};

/**
 * Build a prompt with reference images
 * @param basePrompt - The original prompt
 * @param references - The reference images
 * @returns The enhanced prompt
 */
export function buildReferenceImagePrompt(
  basePrompt: string,
  references: ReferenceImageDescription[]
): PromptWithReferenceImages {
  // strip any existing reference-images section from the prompt
  const promptWithoutReferenceImages = basePrompt.replace(
    /<reference-images>(.*\n)*<\/reference-images>|CHARACTER REFERENCES(.*\n)*$/s,
    ''
  );
  if (references.length === 0) {
    return {
      prompt: promptWithoutReferenceImages,
      referenceUrls: [],
    };
  }

  // Append reference section to prompt
  const enhancedPrompt = `${promptWithoutReferenceImages}
  
  <reference-images>
    ${references.map((reference, index) => `- Image ${index + 1}: ${reference.description}`).join('\n')}
  </reference-images>`;

  return {
    prompt: enhancedPrompt,
    referenceUrls: references.map((reference) => reference.referenceImageUrl),
  };
}
