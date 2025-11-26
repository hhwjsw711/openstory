/**
 * Generate Motion Tool - MCP Integration
 * Uses existing Velro motion generation service
 */

import type { ImageToVideoModel } from '@/lib/ai/models';
import { generateMotionForFrame } from '@/lib/services/motion.service';

export type GenerateMotionInput = {
  imageUrl: string;
  prompt: string;
  model?: string;
  duration?: number;
  fps?: number;
  aspectRatio?: string;
};

export type GenerateMotionOutput = {
  videoUrl?: string;
  model: string;
  prompt: string;
  success: boolean;
  error?: string;
  metadata?: {
    provider: string;
    duration: number;
    fps: number;
  };
  generatedAt: string;
};

/**
 * Generate motion video from image
 */
export async function generateMotionTool(
  input: GenerateMotionInput
): Promise<GenerateMotionOutput> {
  try {
    console.log(
      `[MCP Generate Motion] Generating motion with model ${input.model || 'default'}`
    );

    // Use existing Velro motion service
    const result = await generateMotionForFrame({
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      model: (input.model as ImageToVideoModel) || 'kling_v2_5_turbo_pro',
      duration: input.duration,
      fps: input.fps,
      aspectRatio: input.aspectRatio,
    });

    if (!result.success || !result.videoUrl) {
      throw new Error(result.error || 'Motion generation failed');
    }

    console.log('[MCP Generate Motion] Motion generation complete');

    return {
      videoUrl: result.videoUrl,
      model: (result.metadata?.model as string) || input.model || 'unknown',
      prompt: input.prompt,
      success: true,
      metadata: {
        provider: (result.metadata?.provider as string) || 'unknown',
        duration: (result.metadata?.duration as number) || input.duration || 5,
        fps: (result.metadata?.fps as number) || input.fps || 24,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MCP Generate Motion] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      videoUrl: undefined,
      model: input.model || 'unknown',
      prompt: input.prompt,
      success: false,
      error: errorMessage,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Tool description for MCP
 */
export const generateMotionToolDescription = {
  name: 'generate_motion',
  description: `Generate motion video from a static image using image-to-video AI models.

This tool takes an image URL (from generate_image or generate_frames) and a motion prompt, then creates a video with camera movement and motion.

The motion prompt should describe the desired camera movement and any subject motion (e.g., "Slow dolly forward while character turns head").

Returns a temporary video URL (valid for ~1 hour).`,
  inputSchema: {
    type: 'object',
    properties: {
      imageUrl: {
        type: 'string',
        description:
          'URL of the image to animate (from generate_image or generate_frames)',
      },
      prompt: {
        type: 'string',
        description: 'Motion description (camera movement, subject motion)',
      },
      model: {
        type: 'string',
        description: 'Video generation model (default: kling_v2_5_turbo_pro)',
        enum: [
          'svd_lcm',
          'wan_i2v',
          'kling_i2v',
          'seedance_v1_pro',
          'veo2_i2v',
          'veo3',
          'wan_v2',
          'veo3_1',
          'kling_v2_5_turbo_pro',
          'wan_2_5',
          'sora_2',
        ],
      },
      duration: {
        type: 'number',
        description:
          'Video duration in seconds (model-dependent, usually 5-10s)',
      },
      fps: {
        type: 'number',
        description: 'Frames per second (model-dependent, usually 24-30)',
      },
      aspectRatio: {
        type: 'string',
        description: 'Video aspect ratio',
        enum: ['16:9', '9:16', '1:1', 'auto'],
      },
    },
    required: ['imageUrl', 'prompt'],
  },
};
