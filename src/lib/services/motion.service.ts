/**
 * Motion Generation Service
 * Handles image-to-video generation using various AI models
 */

import {
  IMAGE_TO_VIDEO_MODELS,
  type ImageToVideoModelKey,
} from '@/lib/ai/models';
import type { Json } from '@/types/database';

// Re-export for backward compatibility
export const MOTION_MODELS = IMAGE_TO_VIDEO_MODELS;
export type MotionModel = ImageToVideoModelKey;

interface GenerateMotionOptions {
  imageUrl: string;
  prompt?: string;
  model?: MotionModel;
  duration?: number;
  fps?: number;
  motionBucket?: number;
  styleStack?: Json;
}

interface MotionResult {
  success: boolean;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Enhance prompt for motion generation based on frame context
 */
function enhanceMotionPrompt(
  basePrompt: string | undefined,
  styleStack: Json | undefined
): string {
  let enhancedPrompt = basePrompt || 'Create smooth, natural motion';

  // Add style-specific motion hints
  if (styleStack && typeof styleStack === 'object') {
    const style = styleStack as Record<string, unknown>;

    // Add motion style hints based on the style stack
    if (style.genre === 'action') {
      enhancedPrompt += ', dynamic camera movement, fast-paced action';
    } else if (style.genre === 'drama') {
      enhancedPrompt += ', subtle movements, emotional expressions';
    } else if (style.genre === 'sci-fi') {
      enhancedPrompt += ', futuristic motion, smooth transitions';
    }

    // Add mood-based motion
    if (style.mood === 'tense') {
      enhancedPrompt += ', slow deliberate movements';
    } else if (style.mood === 'exciting') {
      enhancedPrompt += ', energetic motion, quick cuts';
    } else if (style.mood === 'peaceful') {
      enhancedPrompt += ', gentle flowing movements';
    }
  }

  // Add general motion quality hints
  enhancedPrompt +=
    ', maintain visual consistency, smooth transitions, professional cinematography';

  return enhancedPrompt;
}

/**
 * Generate motion for a single frame using Fal.ai
 */
export async function generateMotionForFrame(
  options: GenerateMotionOptions
): Promise<MotionResult> {
  try {
    const modelKey = options.model || 'svd_lcm';
    const modelConfig = MOTION_MODELS[modelKey];

    if (!modelConfig) {
      throw new Error(`Invalid model: ${modelKey}`);
    }

    // Prepare the enhanced prompt
    const enhancedPrompt = enhanceMotionPrompt(
      options.prompt,
      options.styleStack
    );

    // Validate and set parameters using new structure
    const duration = Math.min(
      options.duration || modelConfig.capabilities.defaultDuration,
      modelConfig.capabilities.maxDuration
    );
    const fps = Math.max(
      modelConfig.capabilities.fpsRange.min,
      Math.min(
        options.fps || modelConfig.capabilities.fpsRange.default,
        modelConfig.capabilities.fpsRange.max
      )
    );
    const motionBucket = options.motionBucket || 127; // 1-255, higher = more motion

    // Import Fal.ai client dynamically to avoid initialization issues
    const { fal } = await import('@/lib/ai/fal-client');

    // Call the appropriate Fal.ai model
    let result: unknown;

    switch (modelKey) {
      case 'svd_lcm': {
        // Fast SVD-LCM model - doesn't support prompts
        result = await fal.run(modelConfig.id, {
          input: {
            image_url: options.imageUrl,
            motion_bucket_id: motionBucket,
            cond_aug: 0.02, // Conditioning augmentation
            decoding_t: Math.round(duration * fps), // Number of frames
            video_length: Math.round(duration * fps),
            sizing_strategy: 'maintain_aspect_ratio',
            frames_per_second: fps,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case 'kling_v2_5_turbo_pro': {
        // Kling v2.5 Turbo Pro - requires string duration ("5" or "10")
        const klingDuration = duration <= 7 ? '5' : '10'; // Round to nearest supported value
        result = await fal.run(modelConfig.id, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            duration: klingDuration, // Must be string "5" or "10"
            fps: fps,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case 'wan_i2v':
      case 'kling_i2v':
      case 'veo3':
      case 'wan_v2':
      case 'veo3_1':
      case 'wan_2_5':
      case 'sora_2': {
        // Generic image-to-video models with prompt support
        result = await fal.run(modelConfig.id, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            duration: duration,
            fps: fps,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case 'seedance_v1_pro': {
        // Seedance 1.0 Pro model - uses specific aspect ratio and resolution
        const seedanceConfig =
          modelConfig.capabilities as typeof modelConfig.capabilities & {
            aspectRatio?: string;
            resolution?: string;
          };
        result = await fal.run(modelConfig.id, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            aspect_ratio: seedanceConfig.aspectRatio || '16:9',
            resolution: seedanceConfig.resolution || '1080p',
            duration: duration,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case 'veo2_i2v': {
        // Google Veo 2 image-to-video model
        const veo2Config =
          modelConfig.capabilities as typeof modelConfig.capabilities & {
            aspectRatio?: string;
          };
        result = await fal.run(modelConfig.id, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            duration: duration,
            aspect_ratio: veo2Config.aspectRatio || '16:9',
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      default:
        throw new Error(`Unsupported model: ${modelKey}`);
    }

    // Extract video URL from result
    const videoUrl = (result as { video?: { url?: string } })?.video?.url;

    if (!videoUrl) {
      console.error('[Motion Service] No video URL in result:', result);
      throw new Error('No video URL returned from motion generation');
    }

    return {
      success: true,
      videoUrl,
      metadata: {
        model: modelConfig.id,
        duration,
        fps,
        motionBucket,
        totalFrames: Math.round(duration * fps),
        cost: modelConfig.pricing.estimatedCost,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[Motion Service] Generation failed:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Motion generation failed',
    };
  }
}

/**
 * Select the best model based on requirements
 */
export function selectMotionModel(requirements: {
  speed?: 'fast' | 'balanced' | 'quality';
  budget?: 'low' | 'medium' | 'high';
  duration?: number;
}): MotionModel {
  const { speed = 'balanced', budget = 'medium' } = requirements;

  // Speed priority
  if (speed === 'fast') {
    return 'svd_lcm';
  }

  if (speed === 'quality') {
    return budget === 'high' ? 'veo2_i2v' : 'seedance_v1_pro';
  }

  // Balanced approach
  if (budget === 'low') {
    return 'svd_lcm';
  }

  if (budget === 'high') {
    return 'veo2_i2v';
  }

  return 'wan_i2v';
}

/**
 * Calculate estimated cost and time for motion generation
 */
export function estimateMotionGeneration(
  frameCount: number,
  model: MotionModel = 'svd_lcm'
): {
  totalCost: number;
  totalTime: number; // in seconds
  perFrameCost: number;
  perFrameTime: number;
} {
  const modelConfig = MOTION_MODELS[model];

  return {
    totalCost: frameCount * modelConfig.pricing.estimatedCost,
    totalTime: frameCount * modelConfig.performance.estimatedGenerationTime,
    perFrameCost: modelConfig.pricing.estimatedCost,
    perFrameTime: modelConfig.performance.estimatedGenerationTime,
  };
}
