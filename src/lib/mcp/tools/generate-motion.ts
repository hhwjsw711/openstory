/**
 * Generate Motion Tool - MCP Integration
 * Uses existing Velro motion generation service
 */

import type { ImageToVideoModel } from '@/lib/ai/models';
import { generateMotionForFrame } from '@/lib/services/motion.service';
import type { Scene } from '@/lib/script';

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

export type GenerateMotionFromScenesInput = {
  scenes: Scene[];
  model?: string;
  duration?: number;
  fps?: number;
  aspectRatio?: string;
};

export type SceneMotionResult = {
  sceneId: string;
  sceneNumber: number;
  sceneTitle: string;
  videoUrl?: string;
  prompt: string;
  success: boolean;
  error?: string;
};

export type GenerateMotionFromScenesOutput = {
  results: SceneMotionResult[];
  totalGenerated: number;
  totalFailed: number;
  model: string;
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
 * Generate motion videos from scenes (batch operation)
 * Uses motion prompts from scene analysis
 */
export async function generateMotionFromScenesTool(
  input: GenerateMotionFromScenesInput
): Promise<GenerateMotionFromScenesOutput> {
  try {
    const model = (input.model as ImageToVideoModel) || 'kling_v2_5_turbo_pro';
    const results: SceneMotionResult[] = [];

    console.log(
      `[MCP Generate Motion From Scenes] Generating motion for ${input.scenes.length} scenes with model ${model}`
    );

    for (const scene of input.scenes) {
      // Extract image URL and motion prompt from scene
      const imageUrl = scene.prompts?.visual?.fullPrompt
        ? undefined // Need image URL, not prompt
        : undefined;

      const motionPrompt = scene.prompts?.motion?.fullPrompt;

      if (!motionPrompt) {
        console.warn(
          `[MCP Generate Motion From Scenes] Scene ${scene.sceneId} has no motion prompt, skipping`
        );
        results.push({
          sceneId: scene.sceneId,
          sceneNumber: scene.sceneNumber,
          sceneTitle: scene.metadata.title,
          prompt: '',
          success: false,
          error: 'No motion prompt available',
        });
        continue;
      }

      // Note: This requires the scene to have an image URL from frame generation
      // For now, we'll skip scenes without image URLs
      if (!imageUrl) {
        console.warn(
          `[MCP Generate Motion From Scenes] Scene ${scene.sceneId} has no image URL, skipping. Generate frames first.`
        );
        results.push({
          sceneId: scene.sceneId,
          sceneNumber: scene.sceneNumber,
          sceneTitle: scene.metadata.title,
          prompt: motionPrompt,
          success: false,
          error: 'No image URL available - generate frames first',
        });
        continue;
      }

      try {
        const result = await generateMotionForFrame({
          imageUrl,
          prompt: motionPrompt,
          model,
          duration: input.duration,
          fps: input.fps,
          aspectRatio: input.aspectRatio,
        });

        if (result.success && result.videoUrl) {
          results.push({
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            sceneTitle: scene.metadata.title,
            videoUrl: result.videoUrl,
            prompt: motionPrompt,
            success: true,
          });
        } else {
          results.push({
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            sceneTitle: scene.metadata.title,
            prompt: motionPrompt,
            success: false,
            error: result.error || 'Motion generation failed',
          });
        }
      } catch (error) {
        console.error(
          `[MCP Generate Motion From Scenes] Failed for scene ${scene.sceneId}:`,
          error
        );
        results.push({
          sceneId: scene.sceneId,
          sceneNumber: scene.sceneNumber,
          sceneTitle: scene.metadata.title,
          prompt: motionPrompt,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalGenerated = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    console.log(
      `[MCP Generate Motion From Scenes] Complete: ${totalGenerated}/${input.scenes.length} successful`
    );

    return {
      results,
      totalGenerated,
      totalFailed,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MCP Generate Motion From Scenes] Error:', error);
    throw error;
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
