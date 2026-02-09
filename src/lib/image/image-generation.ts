import {
  getEditEndpoint,
  getTextToImageModelId,
  IMAGE_MODELS,
  type TextToImageModel,
} from '@/lib/ai/models';
import { createImageMedia } from '@/lib/observability/langfuse-media';
import {
  DEFAULT_IMAGE_SIZE,
  type ImageSize,
} from '@/lib/constants/aspect-ratios';
import { type ImageDto, imagesCreate, imagesGet } from '@/lib/letzai/sdk';
import { startObservation } from '@langfuse/tracing';

import {
  type QueueStatus,
  createFalClient,
  isQueueStatus,
} from '@fal-ai/client';
import { getEnv } from '#env';

/**
 * Extended parameters for image generation
 * Supports all parameters across different model families
 */
export type ImageGenerationParams = {
  // Core parameters (all models)
  model: TextToImageModel;
  prompt: string;

  // Sizing - automatically converted to aspect_ratio for models that need it
  imageSize?: ImageSize;

  // Common optional parameters
  numImages?: number;
  seed?: number;
  outputFormat?: 'jpeg' | 'png' | 'webp';

  // Quality control parameters
  numInferenceSteps?: number;
  guidanceScale?: number;
  negativePrompt?: string;

  // Advanced features
  loras?: Array<{ path: string; scale: number }>;
  embeddings?: Array<{ path: string; tokens: string[] }>;

  // LetzAI-specific parameters
  quality?: number;
  creativity?: number;
  hasWatermark?: boolean;
  systemVersion?: number;
  mode?: 'default' | 'sigma';
  // Generic callbacks
  onQueueUpdate?: (update: {
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    logs?: string[];
    progress?: number; // Progress percentage (0-100)
  }) => void;

  // Model-specific features
  style?: string; // Recraft
  colors?: Array<{ r: number; g: number; b: number }>; // Recraft
  resolution?: '1K' | '2K' | '4K'; // Imagen4, Nano Banana Pro
  enhancePrompt?: boolean; // FLUX Pro
  safetyTolerance?: number; // FLUX Pro
  acceleration?: 'none' | 'regular' | 'high'; // FLUX Dev/Schnell/Flux 2
  enablePromptExpansion?: boolean; // FLUX 2

  // Reference images for character consistency (auto-switches to edit endpoint)
  referenceImageUrls?: string[];

  // Langfuse trace name (defaults to 'fal-image')
  traceName?: string;

  // Override Fal.ai API key (e.g., user-provided key). Falls back to platform env key.
  falApiKey?: string;
};

/**
 * Result from image generation
 */
export type ImageGenerationResult = {
  imageUrls: string[];
  parameters: ImageGenerationParams;
  generatedAt: string;
  processingTimeMs: number;
  provider: 'letzai' | 'fal';
  metadata: {
    prompt: string;
    model: string;
    dimensions: { width: number; height: number }[];
    file_sizes: number[];
    seed?: number;
    has_nsfw_concepts?: boolean[];
    cost?: number;
    requestId?: string;
  };
};

/**
 * Helper to convert ImageSize to aspect ratio string
 */
function imageSizeToAspectRatio(imageSize: ImageSize): string {
  const mapping: Record<ImageSize, string> = {
    square_hd: '1:1',
    portrait_16_9: '9:16',
    landscape_16_9: '16:9',
  };
  return mapping[imageSize] ?? '16:9';
}

/**
 * Extract progress percentage from Fal.ai queue update
 * Checks for progress in update object or logs
 */
function extractProgress(update: QueueStatus): number | undefined {
  // Try to extract progress from logs (e.g., "Progress: 45%")
  if (isQueueStatus(update) && update.status === 'IN_PROGRESS') {
    for (const log of update.logs) {
      const message = log.message || '';
      // Look for patterns like "45%", "Progress: 45%", "45% complete"
      const progressMatch = message.match(/(\d+)%/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1], 10);
        if (percent >= 0 && percent <= 100) {
          return percent;
        }
      }
    }
  }

  return undefined;
}

/**
 * Truncate prompt to model's maximum length
 * Returns original prompt if under limit or if model has no limit
 */
function truncatePromptForModel(
  prompt: string,
  model: TextToImageModel
): string {
  const maxLength = IMAGE_MODELS[model].maxPromptLength;
  if (!maxLength || prompt.length <= maxLength) {
    return prompt;
  }

  // Leave room for ellipsis indicator
  const truncated = prompt.slice(0, maxLength - 3) + '...';
  console.warn(
    `[Image Generation] Prompt truncated from ${prompt.length} to ${maxLength} chars for ${model}`
  );
  return truncated;
}

/**
 * Generate image using a switch statement to determine parameters by model type
 * Pure switch-statement approach with fully inlined fal.subscribe calls
 */
export async function generateImageWithProvider(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const modelId = getTextToImageModelId(params.model);

  const span = startObservation(
    params.traceName ?? 'fal-image',
    {
      model: params.model,
      input: {
        prompt: params.prompt,
        imageSize: params.imageSize,
        ...(params.referenceImageUrls &&
          params.referenceImageUrls.length > 0 && {
            referenceImageUrls: params.referenceImageUrls,
          }),
      },
    },
    { asType: 'generation' }
  );

  try {
    const result = await generateImageInternal(params, modelId);

    // Fetch first image for inline preview in Langfuse
    const imageMedia = result.imageUrls[0]
      ? await createImageMedia(result.imageUrls[0])
      : null;

    span
      .update({
        output: {
          imageUrls: result.imageUrls,
          ...(imageMedia && { generatedImage: imageMedia }),
        },
        costDetails: result.metadata.cost
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
 * Internal image generation implementation
 */
async function generateImageInternal(
  params: ImageGenerationParams,
  modelId: string
): Promise<ImageGenerationResult> {
  // Create a per-request fal client (supports user-provided keys)
  const fal = createFalClient({
    credentials: params.falApiKey ?? getEnv().FAL_KEY ?? '',
  });

  // Truncate prompt to model's max length
  const prompt = truncatePromptForModel(params.prompt, params.model);

  switch (params.model) {
    case 'flux_pro':
    case 'flux_dev':
    case 'flux_schnell':
    case 'flux_krea_lora':
    case 'flux_pro_v1_1_ultra': {
      // FLUX family - shared parameters with model-specific variations
      const isUltra = params.model === 'flux_pro_v1_1_ultra';
      const defaultSteps = params.model === 'flux_schnell' ? 4 : 28;
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          // Sizing: Ultra uses aspect_ratio, others use image_size
          ...(isUltra
            ? {
                aspect_ratio: imageSizeToAspectRatio(
                  params.imageSize ?? DEFAULT_IMAGE_SIZE
                ),
              }
            : { image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE }),
          // Inference steps/guidance (not for Ultra)
          ...(!isUltra && {
            num_inference_steps: params.numInferenceSteps ?? defaultSteps,
            guidance_scale: params.guidanceScale ?? 3.5,
          }),
          // Model-specific features
          ...(params.model !== 'flux_pro' && { enable_safety_checker: true }),
          ...(isUltra && { raw: false }),
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          // FLUX Pro/Ultra specific
          ...((params.model === 'flux_pro' || isUltra) &&
            params.safetyTolerance !== undefined && {
              safety_tolerance: params.safetyTolerance.toString(),
            }),
          ...((params.model === 'flux_pro' || isUltra) &&
            params.enhancePrompt !== undefined && {
              enhance_prompt: params.enhancePrompt,
            }),
          // FLUX Dev/Schnell specific
          ...((params.model === 'flux_dev' ||
            params.model === 'flux_schnell') &&
            params.acceleration && { acceleration: params.acceleration }),
          // FLUX Krea specific
          ...(params.model === 'flux_krea_lora' &&
            params.loras && { loras: params.loras }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'flux_2': {
      // FLUX 2 - Enhanced realism, crisper text, native editing
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
          num_inference_steps: params.numInferenceSteps ?? 28,
          guidance_scale: params.guidanceScale ?? 2.5,
          enable_safety_checker: true,
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          ...(params.acceleration && { acceleration: params.acceleration }),
          ...(params.enablePromptExpansion !== undefined && {
            enable_prompt_expansion: params.enablePromptExpansion,
          }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'sdxl':
    case 'sdxl_lightning': {
      // SDXL family - shared parameters with model-specific variations
      const defaultSteps = params.model === 'sdxl_lightning' ? 4 : 25;
      const defaultGuidance = params.model === 'sdxl' ? 7.5 : undefined;
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
          num_inference_steps: params.numInferenceSteps ?? defaultSteps,
          enable_safety_checker: true,
          // SDXL specific
          ...(params.model === 'sdxl' &&
            params.guidanceScale !== undefined && {
              guidance_scale: params.guidanceScale,
            }),
          ...(params.model === 'sdxl' &&
            defaultGuidance !== undefined &&
            params.guidanceScale === undefined && {
              guidance_scale: defaultGuidance,
            }),
          ...(params.model === 'sdxl' &&
            params.negativePrompt && {
              negative_prompt: params.negativePrompt,
            }),
          ...(params.model === 'sdxl' &&
            params.loras && { loras: params.loras }),
          // Common optional params
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { format: params.outputFormat }), // Note: 'format' not 'output_format'
          ...(params.embeddings && { embeddings: params.embeddings }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update: QueueStatus) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'imagen4_preview_ultra': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          aspect_ratio: imageSizeToAspectRatio(
            params.imageSize ?? DEFAULT_IMAGE_SIZE
          ),
          resolution: params.resolution ?? '1K',
          num_images: 1, // Imagen4 only supports 1 image
          ...(params.negativePrompt && {
            negative_prompt: params.negativePrompt,
          }),
          ...(params.seed !== undefined && { seed: params.seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'nano_banana': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          aspect_ratio: imageSizeToAspectRatio(
            params.imageSize ?? DEFAULT_IMAGE_SIZE
          ),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'nano_banana_pro': {
      // Auto-switch to edit endpoint when reference images are provided
      const hasReferences =
        params.referenceImageUrls && params.referenceImageUrls.length > 0;
      const editEndpoint = getEditEndpoint(params.model);
      const endpoint = hasReferences && editEndpoint ? editEndpoint : modelId;

      const resp = await fal.subscribe(endpoint, {
        input: {
          prompt,
          aspect_ratio: imageSizeToAspectRatio(
            params.imageSize ?? DEFAULT_IMAGE_SIZE
          ),
          resolution: params.resolution ?? '2K',
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          // Pass reference images when using edit endpoint
          ...(hasReferences && { image_urls: params.referenceImageUrls }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'recraft_v3': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
          style: params.style ?? 'realistic_image',
          enable_safety_checker: false, // Default false for Recraft
          ...(params.colors &&
            params.colors.length > 0 && { colors: params.colors }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'hidream_i1_full': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size: { width: 1024, height: 1024 }, // HiDream uses object
          num_inference_steps: params.numInferenceSteps ?? 50,
          guidance_scale: params.guidanceScale ?? 5,
          enable_safety_checker: true,
          ...(params.negativePrompt && {
            negative_prompt: params.negativePrompt,
          }),
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          ...(params.loras && { loras: params.loras }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            // Extract progress before mapping logs (needs full log objects)
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'seedream_v4_5': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt,
          image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
          enable_safety_checker: true,
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          sync_mode: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (params.onQueueUpdate) {
            const progress = extractProgress(update);

            params.onQueueUpdate({
              status: update.status,
              logs:
                update.status === 'IN_PROGRESS'
                  ? update.logs?.map((l) => l.message)
                  : undefined,
              progress,
            });
          }
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByFal(params, resp.data);
    }

    case 'letzai': {
      // LetzAI uses custom provider with different API
      const presetDims = {
        square_hd: { width: 1024, height: 1024 },
        portrait_16_9: { width: 576, height: 1024 },
        landscape_16_9: { width: 1600, height: 900 },
      }[params.imageSize ?? DEFAULT_IMAGE_SIZE];

      // TODO: This needs to be updated to use the new SDK
      const resp = await imagesCreate({
        // @ts-expect-error - webhookUrl is not required for imagesCreate
        body: {
          prompt,
          width: presetDims.width,
          height: presetDims.height,
          quality: params.quality ?? 5,
          creativity: params.creativity ?? 2,
          hasWatermark: params.hasWatermark ?? false,
          systemVersion: params.systemVersion ?? 3,
          mode: params.mode ?? 'default',
          hideFromUserProfile: false,
        },
      });
      // @TODO Tom 21 Nov 2025: This is kinda hacky, but it's the best we can do for now

      if (!resp.data) throw new Error('No data returned from LetzAI');
      let imageDto: ImageDto = resp.data;
      do {
        // Now we have to poll the task status until it is completed
        const imageStatusResp = await imagesGet({ path: { id: resp.data.id } });
        if (!imageStatusResp.data)
          throw new Error('No data returned from LetzAI');

        imageDto = imageStatusResp.data;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } while (
        imageDto.status !== 'ready' &&
        imageDto.status !== 'failed' &&
        imageDto.status !== 'interrupted'
      );
      if (imageDto.status === 'failed') {
        throw new Error('Image generation failed');
      }
      if (imageDto.status === 'interrupted') {
        throw new Error('Image generation interrupted');
      }
      return resultByLetzai(params, imageDto);
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = params.model;
      throw new Error(`Unsupported model: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Calculate estimated cost based on model pricing and output
 */
function calculateImageCost(
  model: TextToImageModel,
  numImages: number,
  dimensions: { width: number; height: number }[],
  processingTimeMs: number
): number | undefined {
  const modelConfig = IMAGE_MODELS[model];
  if (!modelConfig.pricing) return undefined;

  const { price, unit } = modelConfig.pricing;

  switch (unit) {
    case 'images':
      // Flat rate per image
      return price * numImages;

    case 'megapixels': {
      // Calculate total megapixels across all images
      const totalMegapixels = dimensions.reduce((sum, dim) => {
        const megapixels = (dim.width * dim.height) / 1_000_000;
        return sum + megapixels;
      }, 0);
      return price * totalMegapixels;
    }

    case 'compute_seconds': {
      // Cost based on compute time
      const seconds = processingTimeMs / 1000;
      return price * seconds;
    }

    default:
      return undefined;
  }
}

/**
 * Parse result for LetzAI provider
 */
function resultByLetzai(
  params: ImageGenerationParams,
  resp: ImageDto
): ImageGenerationResult {
  // Get dimensions from model config preset (LetzAI response doesn't include dimensions)
  const presetDims = {
    square_hd: { width: 1024, height: 1024 },
    portrait_16_9: { width: 576, height: 1024 },
    landscape_16_9: { width: 1600, height: 900 },
  }[params.imageSize ?? DEFAULT_IMAGE_SIZE];

  const originalUrl = resp.imageVersions?.original;
  const dimensions = [{ width: presetDims.width, height: presetDims.height }];

  const result: ImageGenerationResult = {
    imageUrls: typeof originalUrl === 'string' ? [originalUrl] : [],
    parameters: params,
    generatedAt: new Date().toISOString(),
    processingTimeMs: 0, // LetzAI response doesn't include timing info
    provider: 'letzai',
    metadata: {
      prompt: params.prompt,
      model: params.model,
      dimensions,
      file_sizes: [],
      seed: undefined,
      has_nsfw_concepts: undefined,
      cost: calculateImageCost(params.model, 1, dimensions, 0),
      requestId: undefined,
    },
  };

  return result;
}

/**
 * Response type for Fal.ai image generation
 */
type FalImageResponse = {
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
    file_size?: number;
  }>;
  timings?: { inference?: number };
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
  requestId?: string;
  latencyMs?: number;
};

/**
 * Parse result for Fal.ai provider
 */
function resultByFal(
  params: ImageGenerationParams,
  resp: FalImageResponse
): ImageGenerationResult {
  const images = resp.images;
  const timings = resp.timings;
  const latencyMs = resp.latencyMs;

  const imageUrls = Array.isArray(images) ? images.map((img) => img.url) : [];
  const processingTimeMs = timings?.inference || latencyMs || 0;
  const dimensions = Array.isArray(images)
    ? images.map((img) => ({
        width: img.width ?? 0,
        height: img.height ?? 0,
      }))
    : [];
  const file_sizes = Array.isArray(images)
    ? images.map((img) => img.file_size ?? 0)
    : [];

  const numImages = imageUrls.length || params.numImages || 1;

  const result: ImageGenerationResult = {
    imageUrls,
    parameters: params,
    generatedAt: new Date().toISOString(),
    processingTimeMs,
    provider: 'fal',
    metadata: {
      prompt: resp.prompt || params.prompt,
      model: params.model,
      dimensions,
      file_sizes,
      seed: resp.seed,
      has_nsfw_concepts: resp.has_nsfw_concepts,
      cost: calculateImageCost(
        params.model,
        numImages,
        dimensions,
        processingTimeMs
      ),
      requestId: resp.requestId,
    },
  };

  return result;
}
