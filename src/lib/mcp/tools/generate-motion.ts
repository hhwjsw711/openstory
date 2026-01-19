/**
 * Generate Motion Tool - MCP Integration
 * Uses existing Velro motion generation service
 */

import {
  generateMotionForFrame,
  type GenerateMotionOptions,
  type MotionResult,
} from '@/lib/motion/motion-generation';

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
      traceName: 'mcp-motion',
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
