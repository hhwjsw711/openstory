/**
 * Motion Generation Service
 * Handles image-to-video generation using various AI models
 */

import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODEL_KEYS,
  IMAGE_TO_VIDEO_MODELS,
  type ImageToVideoModel,
  type ImageToVideoModelConfig,
} from '@/lib/ai/models';
import {
  createImageMedia,
  createVideoMedia,
} from '@/lib/observability/langfuse-media';

// Re-export for tests
import { getEnv } from '#env';
import { startObservation } from '@langfuse/tracing';
import {
  type AspectRatio,
  aspectRatioSchema,
} from '@/lib/constants/aspect-ratios';
import { generateVideo, getVideoJobStatus } from '@tanstack/ai';
import { falVideo } from '@tanstack/ai-fal';
import { z } from 'zod';

export const generationMotionOptionsSchema = z.object({
  imageUrl: z.url(),
  prompt: z.string(),
  model: z
    .enum(IMAGE_TO_VIDEO_MODEL_KEYS)
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
  // Langfuse trace name (defaults to 'fal-motion')
  traceName?: string;
  // Override Fal.ai API key (e.g., user-provided key). Falls back to platform env key.
  falApiKey?: string;
};

export type MotionResult = {
  success: boolean;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  // Job tracking
  requestId?: string;
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
  kling: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;

    // v3 models support 3-15s continuous durations; older models only "5" or "10"
    const supportedDurations = modelConfig.capabilities.supportedDurations;
    let klingDuration: string;
    if (supportedDurations && supportedDurations.length > 2) {
      const snapped = supportedDurations.reduce((prev, curr) =>
        Math.abs(curr - validatedDuration) < Math.abs(prev - validatedDuration)
          ? curr
          : prev
      );
      klingDuration = String(snapped);
    } else {
      klingDuration = validatedDuration <= 7 ? '5' : '10';
    }

    // Kling O1/v3 uses start_image_url, other Kling models use image_url
    const imageUrlParamName =
      'imageUrlParamName' in modelConfig.capabilities
        ? modelConfig.capabilities.imageUrlParamName
        : 'image_url';

    return {
      prompt: options.prompt,
      [imageUrlParamName]: options.imageUrl,
      duration: klingDuration, // Must be string enum
      cfg_scale: 0.5, // Default CFG scale
      negative_prompt: 'blur, distort, and low quality',
      generate_audio: modelConfig.capabilities.supportsAudio, // Control audio generation
    };
  },

  luma: (options, _modelConfig) => ({
    prompt: options.prompt,
    image_url: options.imageUrl,
    aspect_ratio: options.aspectRatio || '16:9',
    loop: false,
  }),

  google: (options, modelConfig) => {
    let validatedDuration =
      options.duration || modelConfig.capabilities.defaultDuration;

    // If model has discrete supported durations, snap to nearest
    const capabilities = modelConfig.capabilities;
    if (
      'supportedDurations' in capabilities &&
      capabilities.supportedDurations
    ) {
      const supportedDurations = capabilities.supportedDurations;
      validatedDuration = supportedDurations.reduce((prev, curr) =>
        Math.abs(curr - validatedDuration) < Math.abs(prev - validatedDuration)
          ? curr
          : prev
      );
    } else {
      // Otherwise just cap to max
      validatedDuration = Math.min(validatedDuration, capabilities.maxDuration);
    }

    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      aspect_ratio: options.aspectRatio || 'auto',
      duration: `${validatedDuration}s`,
      generate_audio: true,
      resolution: '1080p',
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
    let validatedDuration =
      options.duration || modelConfig.capabilities.defaultDuration;

    // If model has discrete supported durations, snap to nearest
    const capabilities = modelConfig.capabilities;
    if (
      'supportedDurations' in capabilities &&
      capabilities.supportedDurations
    ) {
      const supportedDurations = capabilities.supportedDurations;
      validatedDuration = supportedDurations.reduce((prev, curr) =>
        Math.abs(curr - validatedDuration) < Math.abs(prev - validatedDuration)
          ? curr
          : prev
      );
    } else {
      // Otherwise just cap to max
      validatedDuration = Math.min(validatedDuration, capabilities.maxDuration);
    }

    // Sora 2 API parameters (no fps or seed support)
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: validatedDuration, // Integer enum: 4, 8, or 12
      aspect_ratio: options.aspectRatio || 'auto',
      resolution: '720p', // "auto" or "720p"
    };
  },

  xai: (options, modelConfig) => {
    const validatedDuration = options.duration
      ? Math.min(options.duration, modelConfig.capabilities.maxDuration)
      : modelConfig.capabilities.defaultDuration;
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: Math.round(validatedDuration),
      resolution: '720p',
      aspect_ratio: options.aspectRatio || '16:9',
    };
  },

  wan: (options, modelConfig) => {
    let validatedDuration =
      options.duration || modelConfig.capabilities.defaultDuration;
    const supported = modelConfig.capabilities.supportedDurations;
    if (supported) {
      validatedDuration = supported.reduce((prev, curr) =>
        Math.abs(curr - validatedDuration) < Math.abs(prev - validatedDuration)
          ? curr
          : prev
      );
    }
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: validatedDuration,
      resolution: '1080p',
      enable_prompt_expansion: true,
    };
  },
};

/**
 * Generate motion for a single frame using Fal.ai
 * Uses @tanstack/ai-fal adapter for video generation with polling
 */
export async function generateMotionForFrame(
  options: GenerateMotionOptions
): Promise<MotionResult> {
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

  if (!modelConfig) {
    throw new Error(`Invalid model: ${modelKey}`);
  }

  // Fetch input image for inline preview in Langfuse
  const inputImageMedia = await createImageMedia(options.imageUrl);

  const span = startObservation(
    options.traceName ?? 'fal-motion',
    {
      model: modelKey,
      input: {
        prompt: options.prompt,
        imageUrl: options.imageUrl,
        ...(inputImageMedia && { inputImage: inputImageMedia }),
      },
    },
    { asType: 'generation' }
  );

  try {
    const result = await generateMotionInternal(options, modelConfig);

    // Fetch output video for Langfuse media attachment
    const outputVideoMedia = result.videoUrl
      ? await createVideoMedia(result.videoUrl)
      : null;

    span
      .update({
        output: {
          videoUrl: result.videoUrl,
          ...(outputVideoMedia && { generatedVideo: outputVideoMedia }),
        },
        costDetails:
          typeof result.metadata?.cost === 'number'
            ? { total: result.metadata.cost }
            : undefined,
      })
      .end();
    return result;
  } catch (error) {
    span
      .update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      })
      .end();
    throw error;
  }
}

/**
 * Create a TanStack AI fal video adapter
 */
function createFalVideoAdapter(modelId: string, falApiKey?: string) {
  const key = falApiKey ?? getEnv().FAL_KEY;
  if (key) {
    return falVideo(modelId, { apiKey: key });
  }
  return falVideo(modelId);
}

/**
 * Internal motion generation implementation
 * Uses @tanstack/ai-fal adapters for video generation
 */
async function generateMotionInternal(
  options: GenerateMotionOptions,
  modelConfig: ImageToVideoModelConfig
): Promise<MotionResult> {
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

  // Extract prompt from provider-specific input (all builders include it)
  const prompt =
    typeof input.prompt === 'string' ? input.prompt : options.prompt;
  const { prompt: _prompt, ...modelOptions } = input;

  // Create TanStack AI fal video adapter
  const adapter = createFalVideoAdapter(modelConfig.id, options.falApiKey);

  // Submit video generation job
  const job = await generateVideo({
    adapter,
    prompt,
    modelOptions,
  });

  const requestId = job.jobId;
  console.log(`[Motion Service] Job submitted: ${requestId}`);

  // Poll for completion
  let videoUrl: string | undefined;
  const pollInterval = 5000; // 5 seconds
  const maxPollTime = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    const status = await getVideoJobStatus({
      adapter,
      jobId: requestId,
    });

    if (status.status === 'completed' && status.url) {
      videoUrl = status.url;
      console.log(`[Motion Service] Generation completed`);
      break;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Motion generation failed');
    }

    // Log progress
    if (status.progress !== undefined) {
      console.log(`[Motion Service] Progress: ${status.progress}%`);
    } else {
      console.log(`[Motion Service] Status: ${status.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  if (!videoUrl) {
    throw new Error('Motion generation timed out after 10 minutes');
  }

  const validatedDuration =
    options.duration || modelConfig.capabilities.defaultDuration;
  const validatedFps = options.fps || modelConfig.capabilities.fpsRange.default;

  // Calculate cost based on duration and per-second pricing
  const estimatedCost = modelConfig.pricing.pricePerSecond * validatedDuration;

  return {
    success: true,
    videoUrl,
    requestId,
    metadata: {
      model: modelConfig.id,
      provider: modelConfig.provider,
      duration: validatedDuration,
      fps: validatedFps,
      motionBucket: options.motionBucket,
      totalFrames: Math.round(validatedDuration * validatedFps),
      cost: estimatedCost,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Fal queue status shape returned by fal's queue API
 */
type FalQueueStatus = {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  queue_position?: number;
  response_url?: string;
  cancel_url?: string;
  status_url?: string;
  logs?: Array<{ level: string; message: string }>;
  metrics?: { inference_time?: number };
};

/**
 * Check the status of a motion generation request
 * @param statusUrl The status URL from the MotionResult
 * @returns The current queue status
 */
export async function checkMotionStatus(
  statusUrl: string
): Promise<FalQueueStatus> {
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
