/**
 * Motion Generation Service
 * Handles image-to-video generation using various AI models
 */

import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODELS,
  ImageToVideoModel,
  type ImageToVideoModelConfig,
} from '@/lib/ai/models';

// Re-export for tests
import { getEnv } from '#env';
import { AspectRatio, aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import type { QueueStatus } from '@fal-ai/client';
import { createFalClient } from '@fal-ai/client';
import { z } from 'zod';

export const generationMotionOptionsSchema = z.object({
  imageUrl: z.url(),
  prompt: z.string(),
  model: z
    .enum(
      Object.keys(IMAGE_TO_VIDEO_MODELS) as [keyof typeof IMAGE_TO_VIDEO_MODELS]
    )
    .optional()
    .default(DEFAULT_VIDEO_MODEL),
  duration: z.number().optional(),
  fps: z.number().optional(),
  motionBucket: z.number().optional(),
  aspectRatio: aspectRatioSchema.optional(),
});

export type GenerateMotionOptions = {
  imageUrl: string;
  prompt: string;
  model?: ImageToVideoModel;
  duration?: number;
  fps?: number;
  motionBucket?: number;
  aspectRatio?: AspectRatio;
};

export type MotionResult = {
  success: boolean;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  // Queue status tracking (when using fal.subscribe)
  requestId?: string;
  statusUrl?: string;
  responseUrl?: string;
  cancelUrl?: string;
};

/**
 * Provider-specific input builders
 * Each provider has different API requirements
 */
type ProviderInputBuilder = (
  options: GenerateMotionOptions,
  modelConfig: ImageToVideoModelConfig
) => Record<string, unknown>;

const PROVIDER_INPUT_BUILDERS: Record<string, ProviderInputBuilder> = {
  stability: (options, modelConfig) => {
    // SVD-LCM: Always generates 25 frames, fps controls playback speed
    const validatedFps = options.fps
      ? Math.max(
          modelConfig.capabilities.fpsRange.min,
          Math.min(options.fps, modelConfig.capabilities.fpsRange.max)
        )
      : modelConfig.capabilities.fpsRange.default;

    const validatedMotionBucket = options.motionBucket
      ? Math.max(1, Math.min(options.motionBucket, 255))
      : 127;

    return {
      image_url: options.imageUrl,
      motion_bucket_id: validatedMotionBucket,
      cond_aug: 0.02, // Default conditioning augmentation
      seed: Math.floor(Math.random() * 1000000),
      steps: 4, // Default processing steps
      fps: validatedFps,
    };
  },

  kling: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    // Kling requires string duration: "5" or "10"
    const klingDuration = validatedDuration <= 7 ? '5' : '10';

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: klingDuration, // Must be string enum
      cfg_scale: 0.5, // Default CFG scale
      negative_prompt: 'blur, distort, and low quality',
    };
  },

  minimax: (options, modelConfig) => {
    const modelId = modelConfig.id;

    // WAN 2.1 (wan-i2v) has different params than WAN 2.5
    if (modelId === 'fal-ai/wan-i2v') {
      const validatedFps = options.fps
        ? Math.max(
            modelConfig.capabilities.fpsRange.min,
            Math.min(options.fps, modelConfig.capabilities.fpsRange.max)
          )
        : modelConfig.capabilities.fpsRange.default;

      return {
        prompt: options.prompt,
        image_url: options.imageUrl,
        frames_per_second: validatedFps,
        num_frames: 81, // Default frame count
        resolution: '720p',
        aspect_ratio: options.aspectRatio || 'auto',
        enable_prompt_expansion: false,
        enable_safety_checker: false,
      };
    }

    // WAN 2.5
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    const duration = validatedDuration <= 7 ? '5' : '10'; // String enum

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      resolution: '1080p',
      duration,
      enable_prompt_expansion: true,
      enable_safety_checker: true,
    };
  },

  luma: (options, _modelConfig) => ({
    prompt: options.prompt,
    image_url: options.imageUrl,
    aspect_ratio: options.aspectRatio || '16:9',
    loop: false,
  }),

  google: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    // Veo 2 and Veo 3 have different duration formats
    const modelId = modelConfig.id;
    const durationValue =
      modelId === 'fal-ai/veo2/image-to-video'
        ? `${Math.round(validatedDuration)}s` // "5s", "6s", etc
        : '8s'; // Veo 3 only supports 8s

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      aspect_ratio: options.aspectRatio || 'auto',
      duration: durationValue,
      ...(modelId === 'fal-ai/veo3' && {
        generate_audio: true,
        resolution: '720p',
      }),
    };
  },

  seedance: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    // Duration must be integer string enum
    const duration = String(Math.round(validatedDuration));

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      aspect_ratio: options.aspectRatio || 'auto',
      resolution: '1080p',
      duration,
      camera_fixed: false,
      seed: Math.floor(Math.random() * 1000000),
      enable_safety_checker: true,
    };
  },

  openai: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    const validatedFps = options.fps
      ? Math.max(
          modelConfig.capabilities.fpsRange.min,
          Math.min(options.fps, modelConfig.capabilities.fpsRange.max)
        )
      : modelConfig.capabilities.fpsRange.default;

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: validatedDuration,
      fps: validatedFps,
      seed: Math.floor(Math.random() * 1000000),
    };
  },
};

/**
 * Generate motion for a single frame using Fal.ai
 * Uses fal.subscribe() for queue-based generation with status tracking
 */
export async function generateMotionForFrame(
  options: GenerateMotionOptions
): Promise<MotionResult> {
  try {
    const modelKey = options.model || DEFAULT_VIDEO_MODEL;
    const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

    if (!modelConfig) {
      throw new Error(`Invalid model: ${modelKey}`);
    }

    // Get the provider-specific input builder
    const inputBuilder = PROVIDER_INPUT_BUILDERS[modelConfig.provider];

    if (!inputBuilder) {
      throw new Error(
        `No input builder found for provider: ${modelConfig.provider}`
      );
    }

    // Build provider-specific input
    const input = inputBuilder(options, modelConfig);

    console.log(
      `[Motion Service] Generating motion with model: ${modelConfig.id}`,
      {
        provider: modelConfig.provider,
        promptLength: options.prompt?.length,
        input,
      }
    );

    // Track queue status
    let requestId: string | undefined;
    let statusUrl: string | undefined;
    let responseUrl: string | undefined;
    let cancelUrl: string | undefined;

    // Configure fal client
    const fal = createFalClient({
      credentials: getEnv().FAL_KEY || '',
    });

    // Call the Fal.ai model using subscribe for queue tracking
    const result = await fal.subscribe(modelConfig.id, {
      input,
      logs: true,
      pollInterval: 5000, // Poll every 5 seconds
      onEnqueue: (reqId: string) => {
        requestId = reqId;
        console.log(`[Motion Service] Request enqueued: ${reqId}`);
      },
      onQueueUpdate: (update: QueueStatus) => {
        // Capture URLs on first update
        if (!statusUrl) {
          statusUrl = update.status_url;
          responseUrl = update.response_url;
          cancelUrl = update.cancel_url;

          console.log(`[Motion Service] Queue URLs available:`, {
            statusUrl: update.status_url,
            responseUrl: update.response_url,
            cancelUrl: update.cancel_url,
          });
        }

        // Log queue position
        if (update.status === 'IN_QUEUE' && 'queue_position' in update) {
          console.log(
            `[Motion Service] Queue position: ${update.queue_position}`
          );
        }

        // Log progress
        if (update.status === 'IN_PROGRESS') {
          console.log(`[Motion Service] Generation in progress...`);
          if (update.logs && update.logs.length > 0) {
            update.logs.forEach((log) => {
              console.log(`[Motion Service] ${log.level}: ${log.message}`);
            });
          }
        }

        // Log completion
        if (update.status === 'COMPLETED') {
          console.log(
            `[Motion Service] Generation completed in ${update.metrics?.inference_time || 'unknown'}s`
          );
        }
      },
    });

    console.log('[Motion Service] Result:', JSON.stringify(result, null, 2));

    // Extract video URL from result (subscribe returns { data, requestId })
    const data = (result as { data?: unknown }).data;
    const videoUrl = (data as { video?: { url?: string } })?.video?.url;

    if (!videoUrl) {
      console.error('[Motion Service] No video URL in result:', result);
      throw new Error('No video URL returned from motion generation');
    }

    // Capture requestId from result if not already captured in onEnqueue
    if (!requestId && (result as { requestId?: string }).requestId) {
      requestId = (result as { requestId: string }).requestId;
    }

    const validatedDuration =
      options.duration || modelConfig.capabilities.defaultDuration;
    const validatedFps =
      options.fps || modelConfig.capabilities.fpsRange.default;

    return {
      success: true,
      videoUrl,
      requestId,
      statusUrl,
      responseUrl,
      cancelUrl,
      metadata: {
        model: modelConfig.id,
        provider: modelConfig.provider,
        duration: validatedDuration,
        fps: validatedFps,
        motionBucket: options.motionBucket,
        totalFrames: Math.round(validatedDuration * validatedFps),
        cost: modelConfig.pricing.estimatedCost,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(
      `[Motion Service] Generation failed for model ${options.model || DEFAULT_VIDEO_MODEL}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        imageUrl: options.imageUrl,
        promptLength: options.prompt?.length,
      }
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Motion generation failed',
    };
  }
}

/**
 * Check the status of a motion generation request
 * @param statusUrl The status URL from the MotionResult
 * @returns The current queue status
 */
export async function checkMotionStatus(
  statusUrl: string
): Promise<QueueStatus> {
  const apiKey = getEnv().FAL_KEY;

  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required');
  }

  const response = await fetch(statusUrl, {
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to check status: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get the final result of a motion generation request
 * @param responseUrl The response URL from the MotionResult
 * @returns The completed video result
 */
export async function getMotionResult(
  responseUrl: string
): Promise<{ video: { url: string } }> {
  const apiKey = getEnv().FAL_KEY;

  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required');
  }

  const response = await fetch(responseUrl, {
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get result: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Cancel a motion generation request
 * @param cancelUrl The cancel URL from the MotionResult
 */
export async function cancelMotionGeneration(cancelUrl: string): Promise<void> {
  const apiKey = getEnv().FAL_KEY;

  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required');
  }

  const response = await fetch(cancelUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to cancel: ${response.status} ${response.statusText}`
    );
  }
}
