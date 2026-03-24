import { getEnv } from '#env';
import { calculateVideoCost } from '@/lib/ai/fal-cost';
import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODEL_KEYS,
  IMAGE_TO_VIDEO_MODELS,
  type ImageToVideoModel,
  type ImageToVideoModelConfig,
  videoModelSupportsAudio,
} from '@/lib/ai/models';
import { type Microdollars, microsToUsd } from '@/lib/billing/money';
import {
  type AspectRatio,
  aspectRatioSchema,
} from '@/lib/constants/aspect-ratios';
import type { ScopedDb } from '@/lib/db/scoped';
import { startObservation } from '@langfuse/tracing';
import { generateVideo, getVideoJobStatus } from '@tanstack/ai';
import { falVideo } from '@tanstack/ai-fal';
import { WorkflowNonRetryableError } from '@upstash/workflow';
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
  scopedDb?: ScopedDb; // scopedDb is used to resolve the API key for the motion generation with BYOK
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
    cost: Microdollars;
    generatedAt: string;
    usedOwnKey: boolean;
  };
  error?: string;
  requestId?: string;
};

import { buildModelInput } from './build-model-input';

/** Snap a requested duration to the nearest valid value for a model.
 *  Uses buildModelInput (the Zod transform) to determine the snapped value. */
export function snapDuration(
  requested: number | undefined,
  modelKey: ImageToVideoModel
): number {
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];
  const result = buildModelInput(
    { prompt: 'x', imageUrl: 'https://x', duration: requested },
    modelConfig,
    modelKey
  );
  if ('duration' in result && result.duration != null) {
    return typeof result.duration === 'number'
      ? result.duration
      : parseFloat(String(result.duration));
  }
  return requested ?? 5;
}

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
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const { prompt: truncatedPrompt, ...modelOptions } = buildModelInput(
    options,
    modelConfig,
    modelKey
  );

  if (typeof truncatedPrompt !== 'string') {
    throw new Error('Truncated prompt is not a string');
  }

  console.log(
    `[Motion Service] Generating motion with model: ${modelConfig.id}`,
    {
      provider: modelConfig.provider,
      promptLength: truncatedPrompt.length,
      modelOptions,
    }
  );

  const falApiKeyInfo = options.scopedDb
    ? await options.scopedDb.apiKeys.resolveKey('fal')
    : { key: getEnv().FAL_KEY, source: 'platform' as const };
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  const job = await generateVideo({
    adapter,
    prompt: truncatedPrompt,
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

  const validatedDuration = snapDuration(options.duration, modelKey);

  const providerInput = buildModelInput(options, modelConfig, modelKey);
  const cost = calculateVideoCost({
    endpointId: modelConfig.id,
    durationSeconds: validatedDuration,
    audioEnabled: videoModelSupportsAudio(modelKey),
    resolution:
      'resolution' in providerInput &&
      typeof providerInput.resolution === 'string'
        ? providerInput.resolution
        : undefined,
  });

  return {
    success: true,
    videoUrl,
    requestId,
    metadata: {
      model: modelConfig.id,
      provider: modelConfig.provider,
      duration: validatedDuration,
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

  const modelInput = buildModelInput(options, modelConfig, modelKey);

  const { prompt: truncatedPrompt, ...modelOptions } = modelInput;
  if (typeof truncatedPrompt !== 'string') {
    throw new Error('Truncated prompt is not a string');
  }
  console.log(`[Motion Service] Submitting job with model: ${modelConfig.id}`, {
    provider: modelConfig.provider,
    promptLength: truncatedPrompt.length,
    modelOptions,
  });

  const falApiKeyInfo = options.scopedDb
    ? await options.scopedDb.apiKeys.resolveKey('fal')
    : { key: getEnv().FAL_KEY, source: 'platform' as const };

  // Create the Tanstack AI adapter
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  let job;
  try {
    job = await generateVideo({
      adapter,
      prompt: truncatedPrompt,
      modelOptions,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 422) {
      throw new WorkflowNonRetryableError(
        `Motion job submission rejected (422): ${error.message}`
      );
    }
    throw error;
  }

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
  scopedDb?: ScopedDb
): Promise<MotionPollResult> {
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];
  const falApiKeyInfo = scopedDb
    ? await scopedDb.apiKeys.resolveKey('fal')
    : { key: getEnv().FAL_KEY, source: 'platform' as const };
  const adapter = falVideo(modelConfig.id, {
    apiKey: falApiKeyInfo.key,
  });

  let status;
  try {
    status = await getVideoJobStatus({
      adapter,
      jobId,
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 422) {
      throw new WorkflowNonRetryableError(
        `Motion job polling failed (422): ${error.message}`
      );
    }
    throw error;
  }

  if (status.status === 'completed' && status.url) {
    return { status: 'completed', videoUrl: status.url };
  }
  if (status.status === 'completed' && !status.url) {
    throw new WorkflowNonRetryableError(
      `Motion generation failed: ${status.error || 'No video URL returned'}`
    );
  }
  if (status.status === 'failed') {
    throw new WorkflowNonRetryableError(
      `Motion generation failed: ${status.error || 'Unknown error'}`
    );
  }
  return { status: status.status, progress: status.progress };
}

/**
 * Calculate motion cost + metadata after job completes.
 */
export function calculateMotionMetadata(options: GenerateMotionOptions): {
  cost: number;
  duration: number;
  model: string;
  provider: string;
} {
  const modelKey = options.model || DEFAULT_VIDEO_MODEL;
  const modelConfig = IMAGE_TO_VIDEO_MODELS[modelKey];

  const validatedDuration = snapDuration(options.duration, modelKey);

  const providerInput = buildModelInput(options, modelConfig, modelKey);
  const cost = calculateVideoCost({
    endpointId: modelConfig.id,
    durationSeconds: validatedDuration,
    audioEnabled: videoModelSupportsAudio(modelKey),
    resolution:
      'resolution' in providerInput &&
      typeof providerInput.resolution === 'string'
        ? providerInput.resolution
        : undefined,
  });

  return {
    cost,
    duration: validatedDuration,
    model: modelConfig.id,
    provider: modelConfig.provider,
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
    headers: new Headers({
      Authorization: `Key ${apiKey}`,
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    }),
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
