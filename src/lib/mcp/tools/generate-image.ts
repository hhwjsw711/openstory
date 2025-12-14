/**
 * Generate Image Tool - MCP Integration
 * Uses existing Velro image generation service
 */

import type { TextToImageModel } from '@/lib/ai/models';
import { IMAGE_MODELS } from '@/lib/ai/models';
import { ImageSize } from '@/lib/constants/aspect-ratios';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
  type ImageGenerationResult,
} from '@/lib/image/image-generation';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { z } from 'zod';

/**
 * Get all style names as tuple for enum validation
 */
function getAllStyleNamesTuple(): [string, ...string[]] {
  const names = DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
  if (names.length === 0) {
    throw new Error('No style templates available');
  }
  return names as [string, ...string[]];
}

export const generateImageInputSchema = z.object({
  prompt: z.string(),
  style: z.enum(getAllStyleNamesTuple()),
  model: z
    .enum(
      Object.keys(IMAGE_MODELS) as [TextToImageModel, ...TextToImageModel[]]
    )
    .optional(),
  imageSize: z
    .enum(['square_hd', 'portrait_16_9', 'landscape_16_9'])
    .optional(),
  numImages: z.number().int().min(1).max(4).optional(),
});

type GenerateImageInput = z.infer<typeof generateImageInputSchema>;

/**
 * Get style by name from templates
 */
function getStyleByName(name: string) {
  return DEFAULT_STYLE_TEMPLATES.find(
    (style) => style.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all style names
 */
function getAllStyleNames(): string[] {
  return DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
}

/**
 * Enhance prompt with director style elements
 */
function enhancePromptWithStyle(prompt: string, styleName: string): string {
  const style = getStyleByName(styleName);

  if (!style) {
    throw new Error(
      `Style "${styleName}" not found. Available styles: ${getAllStyleNames().join(', ')}`
    );
  }

  // Build enhanced prompt with style elements
  const styleElements = [
    `Style: ${style.config.artStyle}`,
    `Lighting: ${style.config.lighting}`,
    `Camera: ${style.config.cameraWork}`,
    `Mood: ${style.config.mood}`,
    `Color Grading: ${style.config.colorGrading}`,
  ].join('. ');

  // Combine user prompt with style elements
  return `${prompt}. ${styleElements}`;
}

/**
 * Generate image with director style
 */
export async function generateImageTool(
  input: GenerateImageInput
): Promise<ImageGenerationResult> {
  try {
    // Validate style exists
    const style = getStyleByName(input.style);
    if (!style) {
      throw new Error(
        `Style "${input.style}" not found. Available styles: ${getAllStyleNames().join(', ')}`
      );
    }

    // Enhance prompt with style elements
    const enhancedPrompt = enhancePromptWithStyle(input.prompt, input.style);

    // Prepare generation parameters using existing Velro types
    const params: ImageGenerationParams = {
      prompt: enhancedPrompt,
      model: (input.model as TextToImageModel) || 'nano_banana_pro',
      imageSize: (input.imageSize as ImageSize) || 'landscape_16_9',
      numImages: input.numImages || 1,
    };

    // Use existing Velro image generation service
    const result = await generateImageWithProvider(params);

    return result;
  } catch (error) {
    console.error('[MCP Generate Image] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
const generateImageToolDescription = {
  name: 'generate_image',
  description: `Generate a single cinematic image with a director style applied. 
  
Available styles: ${getAllStyleNames().join(', ')}

The tool will enhance your prompt with the selected director's visual style, including their signature lighting, camera work, mood, and color grading.`,
  inputSchema: generateImageInputSchema,
};
