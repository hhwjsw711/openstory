/**
 * Generate Frames Tool - MCP Integration
 * Uses existing Velro image generation service
 */

import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import type { TextToImageModel } from '@/lib/ai/models';

export type GenerateFramesInput = {
  scenes: Scene[];
  model?: string;
  imageSize?: 'square_hd' | 'portrait_16_9' | 'landscape_16_9';
};

export type FrameResult = {
  sceneId: string;
  sceneNumber: number;
  sceneTitle: string;
  imageUrl: string;
  prompt: string;
};

export type GenerateFramesOutput = {
  frames: FrameResult[];
  totalGenerated: number;
  model: string;
  generatedAt: string;
};

/**
 * Generate frames for all scenes
 */
export async function generateFramesTool(
  input: GenerateFramesInput
): Promise<GenerateFramesOutput> {
  try {
    const frames: FrameResult[] = [];
    const model = (input.model as TextToImageModel) || 'nano_banana_pro';
    const imageSize = input.imageSize || 'landscape_16_9';

    console.log(
      `[MCP Generate Frames] Generating ${input.scenes.length} frames with model ${model}`
    );

    // Generate image for each scene
    for (const scene of input.scenes) {
      // Extract visual prompt
      const visualPrompt = scene.prompts?.visual?.fullPrompt;

      if (!visualPrompt) {
        console.warn(
          `[MCP Generate Frames] Scene ${scene.sceneId} has no visual prompt, skipping`
        );
        continue;
      }

      console.log(
        `[MCP Generate Frames] Generating frame for scene ${scene.sceneId}: ${scene.metadata.title}`
      );

      try {
        const params: ImageGenerationParams = {
          prompt: visualPrompt,
          model,
          imageSize,
          numImages: 1,
        };

        // Use existing Velro image generation service
        const result = await generateImageWithProvider(params);

        if (result.imageUrls.length > 0) {
          frames.push({
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            sceneTitle: scene.metadata.title,
            imageUrl: result.imageUrls[0],
            prompt: visualPrompt,
          });

          console.log(
            `[MCP Generate Frames] ✓ Scene ${scene.sceneId} generated successfully`
          );
        }
      } catch (error) {
        console.error(
          `[MCP Generate Frames] Failed to generate scene ${scene.sceneId}:`,
          error
        );
        // Continue with next scene instead of failing entirely
      }
    }

    console.log(
      `[MCP Generate Frames] Complete: ${frames.length}/${input.scenes.length} frames generated`
    );

    return {
      frames,
      totalGenerated: frames.length,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MCP Generate Frames] Error:', error);
    throw error;
  }
}

/**
 * Tool description for MCP
 */
export const generateFramesToolDescription = {
  name: 'generate_frames',
  description: `Generate images for all scenes from a script analysis.

This tool takes the output from analyze_script and generates an image for each scene using the visual prompts that were created during analysis.

Input should be the scenes array from analyze_script output. Each scene must have a visual prompt (prompts.visual.fullPrompt) to generate an image.

Returns an array of frame results with image URLs (temporary Fal.ai URLs valid for ~1 hour).`,
  inputSchema: {
    type: 'object',
    properties: {
      scenes: {
        type: 'array',
        description:
          'Array of scenes from analyze_script output (must have visual prompts)',
        items: {
          type: 'object',
        },
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
    },
    required: ['scenes'],
  },
};
