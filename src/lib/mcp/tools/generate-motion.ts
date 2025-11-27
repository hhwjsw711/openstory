/**
 * Generate Motion Tool - MCP Integration
 * Uses existing Velro motion generation service
 */

import type { Scene } from '@/lib/script';
import {
  generateMotionForFrame,
  GenerateMotionOptions,
  MotionResult,
} from '@/lib/services/motion.service';

export type GenerateMotionFromScenesInput = Omit<
  GenerateMotionOptions,
  'imageUrl' | 'prompt'
> & {
  scenes: Scene[];
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
  input: GenerateMotionOptions
): Promise<MotionResult> {
  try {
    console.log(
      `[MCP Generate Motion] Generating motion with model ${input.model || 'default'}`
    );

    // Use existing Velro motion service
    const result = await generateMotionForFrame({
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      model: input.model || 'kling_v2_5_turbo_pro',
      duration: input.duration,
      fps: input.fps,
      aspectRatio: input.aspectRatio,
    });

    if (!result.success || !result.videoUrl) {
      throw new Error(result.error || 'Motion generation failed');
    }

    console.log('[MCP Generate Motion] Motion generation complete');

    return result;
  } catch (error) {
    console.error('[MCP Generate Motion] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      videoUrl: undefined,
      success: false,
      error: errorMessage,
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
    const model = input.model || 'kling_v2_5_turbo_pro';
    const results: SceneMotionResult[] = [];

    console.log(
      `[MCP Generate Motion From Scenes] Generating motion for ${input.scenes.length} scenes with model ${model}`
    );

    for (const scene of input.scenes) {
      // Extract image URL and motion prompt from scene
      const imageUrl = scene.sourceImageUrl;

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
