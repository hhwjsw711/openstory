/**
 * Generate Image Tool - MCP Integration
 * Uses existing Velro image generation service
 */

import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import type { TextToImageModel } from '@/lib/ai/models';

export type GenerateImageInput = {
  prompt: string;
  style: string;
  model?: string;
  imageSize?: 'square_hd' | 'portrait_16_9' | 'landscape_16_9';
  numImages?: number;
};

export type GenerateImageOutput = {
  imageUrls: string[];
  style: string;
  model: string;
  enhancedPrompt: string;
  generatedAt: string;
};

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
): Promise<GenerateImageOutput> {
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
      imageSize: input.imageSize || 'landscape_16_9',
      numImages: input.numImages || 1,
    };

    // Use existing Velro image generation service
    const result = await generateImageWithProvider(params);

    return {
      imageUrls: result.imageUrls,
      style: input.style,
      model: result.metadata.model,
      enhancedPrompt,
      generatedAt: result.generatedAt,
    };
  } catch (error) {
    console.error('[MCP Generate Image] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const generateImageToolDescription = {
  name: 'generate_image',
  description: `Generate a single cinematic image with a director style applied. 
  
Available styles: ${getAllStyleNames().join(', ')}

The tool will enhance your prompt with the selected director's visual style, including their signature lighting, camera work, mood, and color grading.`,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The image prompt describing what you want to generate',
      },
      style: {
        type: 'string',
        description: `Director style to apply. Available: ${getAllStyleNames().join(', ')}`,
        enum: getAllStyleNames(),
      },
      model: {
        type: 'string',
        description: 'Image generation model (default: nano_banana_pro)',
        enum: [
          'nano_banana',
          'nano_banana_pro',
          'flux_schnell',
          'flux_dev',
          'flux_pro',
          'flux_pro_v1_1_ultra',
          'flux_krea_lora',
          'sdxl_lightning',
          'sdxl',
          'imagen4_preview_ultra',
          'recraft_v3',
          'hidream_i1_full',
        ],
      },
      imageSize: {
        type: 'string',
        description: 'Image dimensions',
        enum: ['square_hd', 'portrait_16_9', 'landscape_16_9'],
      },
      numImages: {
        type: 'number',
        description: 'Number of images to generate (1-4)',
        minimum: 1,
        maximum: 4,
      },
    },
    required: ['prompt', 'style'],
  },
};
