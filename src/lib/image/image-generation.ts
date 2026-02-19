import {
  getEditEndpoint,
  getTextToImageModelId,
  IMAGE_MODELS,
  type TextToImageModel,
} from '@/lib/ai/models';
import { calculateFalCost } from '@/lib/ai/fal-cost';
import { createImageMedia } from '@/lib/observability/langfuse-media';
import {
  DEFAULT_IMAGE_SIZE,
  type ImageSize,
} from '@/lib/constants/aspect-ratios';
import { type ImageDto, imagesCreate, imagesGet } from '@/lib/letzai/sdk';
import { startObservation } from '@langfuse/tracing';

import { generateImage } from '@tanstack/ai';
import { falImage } from '@tanstack/ai-fal';
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
 * Create a TanStack AI fal adapter for image generation
 */
function createFalAdapter(modelId: string, falApiKey?: string) {
  const key = falApiKey ?? getEnv().FAL_KEY;
  if (key) {
    return falImage(modelId, { apiKey: key });
  }
  return falImage(modelId);
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
 * Uses @tanstack/ai-fal adapters for fal.ai models
 */
async function generateImageInternal(
  params: ImageGenerationParams,
  modelId: string
): Promise<ImageGenerationResult> {
  // Truncate prompt to model's max length
  const prompt = truncatePromptForModel(params.prompt, params.model);
  const startTime = Date.now();

  // LetzAI uses a completely different API - handle separately
  if (params.model === 'letzai') {
    return generateLetzaiImage(params, prompt);
  }

  // Build model-specific options for fal.ai models
  const modelOptions = buildFalModelOptions(params, prompt, modelId);

  // Determine the actual endpoint (may differ from modelId for edit endpoints)
  const endpoint = resolveEndpoint(params, modelId);

  // Create adapter and generate
  const adapter = createFalAdapter(endpoint, params.falApiKey);
  const result = await generateImage({
    adapter,
    prompt,
    modelOptions,
  });

  // Map TanStack AI result to our format
  const imageUrls = result.images
    .map((img) => img.url)
    .filter((url): url is string => !!url);

  if (imageUrls.length === 0) {
    throw new Error('No images returned from generation');
  }

  const processingTimeMs = Date.now() - startTime;
  const numImages = imageUrls.length || params.numImages || 1;

  // Calculate cost using live pricing from fal's Platform API
  const quantity = computeImageBillableQuantity(
    params.model,
    numImages,
    params.imageSize ?? DEFAULT_IMAGE_SIZE,
    processingTimeMs
  );
  const cost =
    quantity !== undefined
      ? await calculateFalCost(endpoint, quantity, params.falApiKey)
      : undefined;

  return {
    imageUrls,
    parameters: params,
    generatedAt: new Date().toISOString(),
    processingTimeMs,
    provider: 'fal',
    metadata: {
      prompt: params.prompt,
      model: params.model,
      dimensions: imageUrls.map(() => ({ width: 0, height: 0 })), // Not available from adapter
      file_sizes: imageUrls.map(() => 0),
      seed: params.seed,
      has_nsfw_concepts: undefined,
      cost,
    },
  };
}

/**
 * Resolve the actual fal endpoint (handles edit endpoint switching)
 */
function resolveEndpoint(
  params: ImageGenerationParams,
  modelId: string
): string {
  if (params.model === 'nano_banana_pro') {
    const hasReferences =
      params.referenceImageUrls && params.referenceImageUrls.length > 0;
    const editEndpoint = getEditEndpoint(params.model);
    if (hasReferences && editEndpoint) return editEndpoint;
  }
  return modelId;
}

/**
 * Build model-specific options for fal.ai image generation
 * Each model has different API requirements
 */
function buildFalModelOptions(
  params: ImageGenerationParams,
  _prompt: string,
  _modelId: string
): Record<string, unknown> {
  switch (params.model) {
    case 'flux_pro':
    case 'flux_dev':
    case 'flux_schnell':
    case 'flux_krea_lora':
    case 'flux_pro_v1_1_ultra': {
      const isUltra = params.model === 'flux_pro_v1_1_ultra';
      const defaultSteps = params.model === 'flux_schnell' ? 4 : 28;
      return {
        ...(isUltra
          ? {
              aspect_ratio: imageSizeToAspectRatio(
                params.imageSize ?? DEFAULT_IMAGE_SIZE
              ),
            }
          : { image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE }),
        ...(!isUltra && {
          num_inference_steps: params.numInferenceSteps ?? defaultSteps,
          guidance_scale: params.guidanceScale ?? 3.5,
        }),
        ...(params.model !== 'flux_pro' && { enable_safety_checker: true }),
        ...(isUltra && { raw: false }),
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        ...((params.model === 'flux_pro' || isUltra) &&
          params.safetyTolerance !== undefined && {
            safety_tolerance: params.safetyTolerance.toString(),
          }),
        ...((params.model === 'flux_pro' || isUltra) &&
          params.enhancePrompt !== undefined && {
            enhance_prompt: params.enhancePrompt,
          }),
        ...((params.model === 'flux_dev' || params.model === 'flux_schnell') &&
          params.acceleration && { acceleration: params.acceleration }),
        ...(params.model === 'flux_krea_lora' &&
          params.loras && { loras: params.loras }),
        sync_mode: false,
      };
    }

    case 'flux_2':
      return {
        image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
        num_inference_steps: params.numInferenceSteps ?? 28,
        guidance_scale: params.guidanceScale ?? 2.5,
        enable_safety_checker: true,
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        ...(params.acceleration && { acceleration: params.acceleration }),
        ...(params.enablePromptExpansion !== undefined && {
          enable_prompt_expansion: params.enablePromptExpansion,
        }),
        sync_mode: false,
      };

    case 'sdxl':
    case 'sdxl_lightning': {
      const defaultSteps = params.model === 'sdxl_lightning' ? 4 : 25;
      const defaultGuidance = params.model === 'sdxl' ? 7.5 : undefined;
      return {
        image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
        num_inference_steps: params.numInferenceSteps ?? defaultSteps,
        enable_safety_checker: true,
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
        ...(params.model === 'sdxl' && params.loras && { loras: params.loras }),
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { format: params.outputFormat }),
        ...(params.embeddings && { embeddings: params.embeddings }),
        sync_mode: false,
      };
    }

    case 'imagen4_preview_ultra':
      return {
        aspect_ratio: imageSizeToAspectRatio(
          params.imageSize ?? DEFAULT_IMAGE_SIZE
        ),
        resolution: params.resolution ?? '1K',
        num_images: 1,
        ...(params.negativePrompt && {
          negative_prompt: params.negativePrompt,
        }),
        ...(params.seed !== undefined && { seed: params.seed }),
      };

    case 'nano_banana':
      return {
        aspect_ratio: imageSizeToAspectRatio(
          params.imageSize ?? DEFAULT_IMAGE_SIZE
        ),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        sync_mode: false,
      };

    case 'nano_banana_pro': {
      const hasReferences =
        params.referenceImageUrls && params.referenceImageUrls.length > 0;
      return {
        aspect_ratio: imageSizeToAspectRatio(
          params.imageSize ?? DEFAULT_IMAGE_SIZE
        ),
        resolution: params.resolution ?? '2K',
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        ...(hasReferences && { image_urls: params.referenceImageUrls }),
        sync_mode: false,
      };
    }

    case 'recraft_v3':
      return {
        image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
        style: params.style ?? 'realistic_image',
        enable_safety_checker: false,
        ...(params.colors &&
          params.colors.length > 0 && { colors: params.colors }),
      };

    case 'hidream_i1_full':
      return {
        image_size: { width: 1024, height: 1024 },
        num_inference_steps: params.numInferenceSteps ?? 50,
        guidance_scale: params.guidanceScale ?? 5,
        enable_safety_checker: true,
        ...(params.negativePrompt && {
          negative_prompt: params.negativePrompt,
        }),
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        ...(params.loras && { loras: params.loras }),
        sync_mode: false,
      };

    case 'seedream_v4_5':
      return {
        image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
        enable_safety_checker: true,
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        sync_mode: false,
      };

    case 'kling_image_v3':
      return {
        aspect_ratio: imageSizeToAspectRatio(
          params.imageSize ?? DEFAULT_IMAGE_SIZE
        ),
        resolution: params.resolution ?? '1K',
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
      };

    case 'flux_2_klein_4b':
      return {
        image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
        num_inference_steps: params.numInferenceSteps ?? 4,
        enable_safety_checker: true,
        ...(params.seed !== undefined && { seed: params.seed }),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        sync_mode: false,
      };

    case 'gpt_image_1_5': {
      const sizeMap: Record<ImageSize, string> = {
        square_hd: '1024x1024',
        portrait_16_9: '1024x1536',
        landscape_16_9: '1536x1024',
      };
      return {
        image_size: sizeMap[params.imageSize ?? DEFAULT_IMAGE_SIZE],
        quality: 'high',
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        sync_mode: false,
      };
    }

    case 'grok_imagine_image':
      return {
        aspect_ratio: imageSizeToAspectRatio(
          params.imageSize ?? DEFAULT_IMAGE_SIZE
        ),
        ...(params.numImages !== undefined && { num_images: params.numImages }),
        ...(params.outputFormat && { output_format: params.outputFormat }),
        sync_mode: false,
      };

    case 'letzai':
      // Handled separately in generateLetzaiImage
      return {};

    default: {
      const _exhaustive: never = params.model;
      throw new Error(`Unsupported model: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Generate image via LetzAI (non-fal provider)
 */
async function generateLetzaiImage(
  params: ImageGenerationParams,
  prompt: string
): Promise<ImageGenerationResult> {
  const presetDims = {
    square_hd: { width: 1024, height: 1024 },
    portrait_16_9: { width: 576, height: 1024 },
    landscape_16_9: { width: 1600, height: 900 },
  }[params.imageSize ?? DEFAULT_IMAGE_SIZE];

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

  if (!resp.data) throw new Error('No data returned from LetzAI');
  let imageDto: ImageDto = resp.data;
  do {
    const imageStatusResp = await imagesGet({ path: { id: resp.data.id } });
    if (!imageStatusResp.data) throw new Error('No data returned from LetzAI');

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

/**
 * Image size presets to pixel dimensions for megapixel cost calculation
 */
const IMAGE_SIZE_DIMENSIONS: Record<
  ImageSize,
  { width: number; height: number }
> = {
  square_hd: { width: 1024, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_16_9: { width: 1344, height: 768 },
};

/**
 * Compute the billable quantity for an image generation based on its pricing unit.
 * Returns undefined for models without fal pricing (e.g. LetzAI).
 */
function computeImageBillableQuantity(
  model: TextToImageModel,
  numImages: number,
  imageSize: ImageSize,
  processingTimeMs: number
): number | undefined {
  const modelConfig = IMAGE_MODELS[model];
  if (!modelConfig.pricing) return undefined;

  const { unit } = modelConfig.pricing;

  switch (unit) {
    case 'images':
      return numImages;

    case 'megapixels': {
      const dims = IMAGE_SIZE_DIMENSIONS[imageSize];
      const megapixelsPerImage = (dims.width * dims.height) / 1_000_000;
      return megapixelsPerImage * numImages;
    }

    case 'compute_seconds':
      return processingTimeMs / 1000;

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
      cost: undefined, // LetzAI pricing is not tracked via fal
      requestId: undefined,
    },
  };

  return result;
}
