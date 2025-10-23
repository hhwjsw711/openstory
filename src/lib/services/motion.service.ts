/**
 * Motion Generation Service
 * Handles image-to-video generation using various AI models
 */

import { IMAGE_TO_VIDEO_MODELS } from "@/lib/ai/models";
import type { Json } from "@/types/database";

// Model configurations with pricing and performance characteristics
// Keys must match image-to-video model keys from IMAGE_TO_VIDEO_MODELS
export const MOTION_MODELS = {
  svd_lcm: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.svd_lcm,
    name: "Fast Motion (SVD-LCM)",
    duration: 5, // seconds to generate
    cost: 0.1, // per frame
    quality: "good",
    defaultDuration: 2, // seconds of output video
    defaultFps: 7,
    maxDuration: 4,
    minFps: 7,
    maxFps: 15,
  },
  wan_i2v: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.wan_i2v,
    name: "Balanced Motion (WAN I2V)",
    duration: 10, // seconds to generate
    cost: 0.3, // per frame
    quality: "better",
    defaultDuration: 3,
    defaultFps: 24,
    maxDuration: 5,
    minFps: 12,
    maxFps: 30,
  },
  kling_i2v: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.kling_i2v,
    name: "High Quality Motion (Kling I2V)",
    duration: 15, // seconds to generate
    cost: 0.4, // per frame
    quality: "better",
    defaultDuration: 5,
    defaultFps: 30,
    maxDuration: 10,
    minFps: 24,
    maxFps: 60,
  },
  seedance_v1_pro: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.seedance_v1_pro,
    name: "Premium Motion (Seedance Pro)",
    duration: 12, // seconds to generate
    cost: 0.5, // per frame
    quality: "best",
    defaultDuration: 5,
    defaultFps: 25,
    maxDuration: 8,
    minFps: 15,
    maxFps: 30,
  },
  veo2_i2v: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.veo2_i2v,
    name: "Ultra Premium Motion (Google Veo 2)",
    duration: 20, // seconds to generate
    cost: 0.8, // per frame
    quality: "best",
    defaultDuration: 8,
    defaultFps: 30,
    maxDuration: 10,
    minFps: 24,
    maxFps: 60,
  },
  veo3: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.veo3,
    name: "Ultra Premium Motion with Audio (Google Veo 3)",
    duration: 25, // seconds to generate
    cost: 1.0, // per frame
    quality: "best",
    defaultDuration: 10,
    defaultFps: 30,
    maxDuration: 12,
    minFps: 24,
    maxFps: 60,
  },
  wan_v2: {
    provider: "fal",
    model: IMAGE_TO_VIDEO_MODELS.wan_v2,
    name: "Cinematic Quality Motion (WAN 2.2)",
    duration: 18, // seconds to generate
    cost: 0.7, // per frame
    quality: "best",
    defaultDuration: 6,
    defaultFps: 30,
    maxDuration: 10,
    minFps: 24,
    maxFps: 60,
  },
} as const;

export type MotionModel = keyof typeof MOTION_MODELS;

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
  let enhancedPrompt = basePrompt || "Create smooth, natural motion";

  // Add style-specific motion hints
  if (styleStack && typeof styleStack === "object") {
    const style = styleStack as Record<string, unknown>;

    // Add motion style hints based on the style stack
    if (style.genre === "action") {
      enhancedPrompt += ", dynamic camera movement, fast-paced action";
    } else if (style.genre === "drama") {
      enhancedPrompt += ", subtle movements, emotional expressions";
    } else if (style.genre === "sci-fi") {
      enhancedPrompt += ", futuristic motion, smooth transitions";
    }

    // Add mood-based motion
    if (style.mood === "tense") {
      enhancedPrompt += ", slow deliberate movements";
    } else if (style.mood === "exciting") {
      enhancedPrompt += ", energetic motion, quick cuts";
    } else if (style.mood === "peaceful") {
      enhancedPrompt += ", gentle flowing movements";
    }
  }

  // Add general motion quality hints
  enhancedPrompt +=
    ", maintain visual consistency, smooth transitions, professional cinematography";

  return enhancedPrompt;
}

/**
 * Generate motion for a single frame using Fal.ai
 */
export async function generateMotionForFrame(
  options: GenerateMotionOptions
): Promise<MotionResult> {
  try {
    const modelKey = options.model || "svd_lcm";
    const modelConfig = MOTION_MODELS[modelKey];

    if (!modelConfig) {
      throw new Error(`Invalid model: ${modelKey}`);
    }

    // Prepare the enhanced prompt
    const enhancedPrompt = enhanceMotionPrompt(
      options.prompt,
      options.styleStack
    );

    // Validate and set parameters
    const duration = Math.min(
      options.duration || modelConfig.defaultDuration,
      modelConfig.maxDuration
    );
    const fps = Math.max(
      modelConfig.minFps,
      Math.min(options.fps || modelConfig.defaultFps, modelConfig.maxFps)
    );
    const motionBucket = options.motionBucket || 127; // 1-255, higher = more motion

    // Import Fal.ai client dynamically to avoid initialization issues
    const { fal } = await import("@/lib/ai/fal-client");

    // Call the appropriate Fal.ai model
    let result: unknown;

    switch (modelKey) {
      case "svd_lcm": {
        // Fast SVD-LCM model
        result = await fal.run(modelConfig.model, {
          input: {
            image_url: options.imageUrl,
            motion_bucket_id: motionBucket,
            cond_aug: 0.02, // Conditioning augmentation
            decoding_t: Math.round(duration * fps), // Number of frames
            video_length: Math.round(duration * fps),
            sizing_strategy: "maintain_aspect_ratio",
            frames_per_second: fps,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case "wan_i2v":
      case "kling_i2v": {
        // Generic image-to-video models with prompt support
        result = await fal.run(modelConfig.model, {
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

      case "seedance_v1_pro": {
        // Seedance 1.0 Pro model
        result = await fal.run(modelConfig.model, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            aspect_ratio: "16:9", // Always use 16:9 aspect ratio
            resolution: "1080p", // Always use 1080p resolution
            duration: duration,
            seed: Math.floor(Math.random() * 1000000),
          },
        });
        break;
      }

      case "veo2_i2v": {
        // Google Veo 2 image-to-video model
        result = await fal.run(modelConfig.model, {
          input: {
            prompt: enhancedPrompt,
            image_url: options.imageUrl,
            duration: duration,
            aspect_ratio: "16:9",
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
      console.error("[Motion Service] No video URL in result:", result);
      throw new Error("No video URL returned from motion generation");
    }

    return {
      success: true,
      videoUrl,
      metadata: {
        model: modelConfig.model,
        duration,
        fps,
        motionBucket,
        totalFrames: Math.round(duration * fps),
        cost: modelConfig.cost,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[Motion Service] Generation failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Motion generation failed",
    };
  }
}

/**
 * Select the best model based on requirements
 */
export function selectMotionModel(requirements: {
  speed?: "fast" | "balanced" | "quality";
  budget?: "low" | "medium" | "high";
  duration?: number;
}): MotionModel {
  const { speed = "balanced", budget = "medium" } = requirements;

  // Speed priority
  if (speed === "fast") {
    return "svd_lcm";
  }

  if (speed === "quality") {
    return budget === "high" ? "veo2_i2v" : "seedance_v1_pro";
  }

  // Balanced approach
  if (budget === "low") {
    return "svd_lcm";
  }

  if (budget === "high") {
    return "veo2_i2v";
  }

  return "wan_i2v";
}

/**
 * Calculate estimated cost and time for motion generation
 */
export function estimateMotionGeneration(
  frameCount: number,
  model: MotionModel = "svd_lcm"
): {
  totalCost: number;
  totalTime: number; // in seconds
  perFrameCost: number;
  perFrameTime: number;
} {
  const modelConfig = MOTION_MODELS[model];

  return {
    totalCost: frameCount * modelConfig.cost,
    totalTime: frameCount * modelConfig.duration,
    perFrameCost: modelConfig.cost,
    perFrameTime: modelConfig.duration,
  };
}
