import { calculateVideoCost } from '@/lib/ai/fal-cost';
import { type Microdollars, microsToUsd } from '@/lib/billing/money';
import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODEL_KEYS,
  IMAGE_TO_VIDEO_MODELS,
  type ImageToVideoModel,
  type ImageToVideoModelConfig,
} from '@/lib/ai/models';
import { getEnv } from '#env';
import {
  type AspectRatio,
  aspectRatioSchema,
} from '@/lib/constants/aspect-ratios';
import { startObservation } from '@langfuse/tracing';
import { generateVideo, getVideoJobStatus } from '@tanstack/ai';
import { falVideo } from '@tanstack/ai-fal';
import { z } from 'zod';
import { createScopedDb } from '@/lib/db/scoped';

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
  teamId?: string; // required to resolve the API key for the motion generation with BYOK
  imageUrl: string;
  prompt: string;
  model?: ImageToVideoModel;
  duration?: number;
  fps?: number;
  motionBucket?: number;
  aspectRatio?: AspectRatio;
  // Langfuse trace name (defaults to 'fal-motion')
  traceName?: string;
};

export type MotionResult = {
  success: boolean;
  videoUrl?: string;
  metadata: {
    model: string;
    provider: string;
    duration: number;
    fps: number;
    motionBucket?: number;
    totalFrames: number;
    cost: Microdollars;
    generatedAt: string;
    usedOwnKey: boolean;
  };
  error?: string;
  requestId?: string;
};

/**
 * Snap a requested duration to the nearest supported value for a model.
 * Falls back to capping at maxDuration if no discrete durations are defined.
 */
export function snapDuration(
  requested: number | undefined,
  capabilities: ImageToVideoModelConfig['capabilities']
): number {
  const duration = requested ?? capabilities.defaultDuration;
  const supported =
    'supportedDurations' in capabilities
      ? capabilities.supportedDurations
      : undefined;

  if (supported && supported.length > 0) {
    return supported.reduce((prev, curr) =>
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
  }

  return Math.min(duration, capabilities.maxDuration);
}

/** Provider-specific input builders -- each provider has different API requirements */
const PROVIDER_INPUT_BUILDERS: Record<
  string,
  (
    options: GenerateMotionOptions,
    modelConfig: ImageToVideoModelConfig
  ) => Record<string, unknown>
> = {
  kling: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    const imageUrlParam =
      'imageUrlParamName' in modelConfig.capabilities
        ? modelConfig.capabilities.imageUrlParamName
        : 'image_url';

    return {
      prompt: options.prompt,
      [imageUrlParam]: options.imageUrl,
      duration: String(duration),
      cfg_scale: 0.5,
      negative_prompt: 'blur, distort, and low quality',
      generate_audio: modelConfig.capabilities.supportsAudio,
    };
  },

  luma: (options) => ({
    prompt: options.prompt,
    image_url: options.imageUrl,
    aspect_ratio: options.aspectRatio || '16:9',
    loop: false,
  }),

  google: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      aspect_ratio: options.aspectRatio || 'auto',
      duration: `${duration}s`,
      generate_audio: true,
      resolution: '1080p',
    };
  },

  seedance: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      aspect_ratio: options.aspectRatio || 'auto',
      resolution: '1080p',
      duration: String(Math.round(duration)),
      camera_fixed: false,
      seed: Math.floor(Math.random() * 1000000),
      enable_safety_checker: true,
    };
  },

  openai: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration,
      aspect_ratio: options.aspectRatio || 'auto',
      resolution: '720p',
    };
  },

  xai: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: Math.round(duration),
      resolution: '720p',
      aspect_ratio: options.aspectRatio || '16:9',
    };
  },

  wan: (options, modelConfig) => {
    const duration = snapDuration(options.duration, modelConfig.capabilities);
    return {
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration,
      resolution: '1080p',
      enable_prompt_expansion: true,
    };
  },
};

/** Generate motion for a single frame using Fal.ai with Langfuse tracing */
export async function generateMotionForFrame(
  options: GenerateMotionOptions
): Promise<MotionResult> {
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

  if (!modelConfig) {
    throw new Error(`Invalid model: ${modelKey}`);
  }

  const span = startObservation(
    options.traceName ?? 'fal-motion',
    {
      model: modelKey,
      input: {
        prompt: options.prompt,
        imageUrl: options.imageUrl,
      },
    },
    { asType: 'generation' }
  );

  try {
    const result = await generateMotionInternal(options, modelConfig);

    span
      .update({
        output: {
          videoUrl: result.videoUrl,
        },
        costDetails: result.metadata?.cost
          ? { total: microsToUsd(result.metadata.cost) }
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

async function generateMotionInternal(
  options: GenerateMotionOptions,
  modelConfig: ImageToVideoModelConfig
): Promise<MotionResult> {
  const inputBuilder = PROVIDER_INPUT_BUILDERS[modelConfig.provider];

  if (!inputBuilder) {
    throw new Error(
      `No input builder found for provider: ${modelConfig.provider}`
    );
  }

  const { prompt: _prompt, ...modelOptions } = inputBuilder(
    options,
    modelConfig
  );

  console.log(
    `[Motion Service] Generating motion with model: ${modelConfig.id}`,
    {
      provider: modelConfig.provider,
      promptLength: options.prompt?.length,
      modelOptions,
    }
  );

  const falApiKeyInfo = await createScopedDb(
    options.teamId ?? ''
  ).apiKeys.resolveKey('fal');
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  const job = await generateVideo({
    adapter,
    prompt: options.prompt,
    modelOptions,
  });

  const requestId = job.jobId;
  console.log(`[Motion Service] Job submitted: ${requestId}`);

  // TB Feb 2026: This bit is not a great a piece of code!
  // It holds the thread while the job is in progress, and it's not a great user experience.
  // Fal supports webhooks, I will look at updating the Fal adapter to use webhooks

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

  const validatedDuration = snapDuration(
    options.duration,
    modelConfig.capabilities
  );
  const validatedFps = options.fps || modelConfig.capabilities.fpsRange.default;

  const providerInput = inputBuilder(options, modelConfig);
  const cost = calculateVideoCost({
    endpointId: modelConfig.id,
    durationSeconds: validatedDuration,
    audioEnabled: modelConfig.capabilities.supportsAudio,
    resolution:
      typeof providerInput.resolution === 'string'
        ? providerInput.resolution
        : undefined,
    fps: validatedFps,
  });

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
      cost,
      generatedAt: new Date().toISOString(),
      usedOwnKey: falApiKeyInfo.source === 'team',
    },
  };
}

// --- Split API for durable workflow polling ---

export type MotionJobSubmission = {
  jobId: string;
  modelKey: ImageToVideoModel;
  usedOwnKey: boolean;
};

/**
 * Submit a motion generation job without polling.
 * Returns the job ID so the workflow can poll with `context.sleep()` between steps.
 */
export async function submitMotionJob(
  options: GenerateMotionOptions
): Promise<MotionJobSubmission> {
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

  if (!modelConfig) {
    throw new Error(`Invalid model: ${modelKey}`);
  }

  const inputBuilder = PROVIDER_INPUT_BUILDERS[modelConfig.provider];
  if (!inputBuilder) {
    throw new Error(
      `No input builder found for provider: ${modelConfig.provider}`
    );
  }

  const { prompt: _prompt, ...modelOptions } = inputBuilder(
    options,
    modelConfig
  );

  console.log(`[Motion Service] Submitting job with model: ${modelConfig.id}`, {
    provider: modelConfig.provider,
    promptLength: options.prompt?.length,
    modelOptions,
  });

  const falApiKeyInfo = await createScopedDb(
    options.teamId ?? ''
  ).apiKeys.resolveKey('fal');
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  const job = await generateVideo({
    adapter,
    prompt: options.prompt,
    modelOptions,
  });

  console.log(`[Motion Service] Job submitted: ${job.jobId}`);

  return {
    jobId: job.jobId,
    modelKey,
    usedOwnKey: falApiKeyInfo.source === 'team',
  };
}

export type MotionPollResult = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress?: number;
  error?: string;
};

/**
 * Check the status of a submitted motion job.
 * Designed to be called from individual workflow steps.
 */
export async function pollMotionJob(
  jobId: string,
  modelKey: ImageToVideoModel,
  teamId?: string
): Promise<MotionPollResult> {
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];
  const falApiKeyInfo = await createScopedDb(teamId ?? '').apiKeys.resolveKey(
    'fal'
  );
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  const status = await getVideoJobStatus({
    adapter,
    jobId,
  });

  if (status.status === 'completed' && status.url) {
    return { status: 'completed', videoUrl: status.url };
  }
  if (status.status === 'failed') {
    return {
      status: 'failed',
      error: status.error || 'Motion generation failed',
    };
  }
  return { status: status.status, progress: status.progress };
}

/**
 * Calculate motion cost + metadata after job completes.
 */
export function calculateMotionMetadata(options: GenerateMotionOptions): {
  cost: number;
  duration: number;
  fps: number;
  model: string;
  provider: string;
  totalFrames: number;
} {
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];
  const inputBuilder = PROVIDER_INPUT_BUILDERS[modelConfig.provider];

  const validatedDuration = snapDuration(
    options.duration,
    modelConfig.capabilities
  );
  const validatedFps = options.fps || modelConfig.capabilities.fpsRange.default;

  const providerInput = inputBuilder(options, modelConfig);
  const cost = calculateVideoCost({
    endpointId: modelConfig.id,
    durationSeconds: validatedDuration,
    audioEnabled: modelConfig.capabilities.supportsAudio,
    resolution:
      typeof providerInput.resolution === 'string'
        ? providerInput.resolution
        : undefined,
    fps: validatedFps,
  });

  return {
    cost,
    duration: validatedDuration,
    fps: validatedFps,
    model: modelConfig.id,
    provider: modelConfig.provider,
    totalFrames: Math.round(validatedDuration * validatedFps),
  };
}

type FalQueueStatus = {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  queue_position?: number;
  response_url?: string;
  cancel_url?: string;
  status_url?: string;
  logs?: Array<{ level: string; message: string }>;
  metrics?: { inference_time?: number };
};

/** Authenticated fetch against the fal queue API */
async function falQueueFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const apiKey = getEnv().FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required');
  }

  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${apiKey}`, ...init?.headers },
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function checkMotionStatus(
  statusUrl: string
): Promise<FalQueueStatus> {
  const response = await falQueueFetch(statusUrl);
  return response.json();
}

export async function getMotionResult(
  responseUrl: string
): Promise<{ video: { url: string } }> {
  const response = await falQueueFetch(responseUrl);
  return response.json();
}

export async function cancelMotionGeneration(cancelUrl: string): Promise<void> {
  await falQueueFetch(cancelUrl, { method: 'PUT' });
}
