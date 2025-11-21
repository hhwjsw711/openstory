import { getTextToImageModelId, type TextToImageModel } from '@/lib/ai/models';
import {
  DEFAULT_IMAGE_SIZE,
  type ImageSize,
} from '@/lib/constants/aspect-ratios';
import { ImageDto, imagesCreate, imagesGet } from '@/lib/letzai/sdk';

import { fal } from '@fal-ai/client';

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

  // Model-specific features
  style?: string; // Recraft
  colors?: Array<{ r: number; g: number; b: number }>; // Recraft
  resolution?: '1K' | '2K'; // Imagen4
  enhancePrompt?: boolean; // FLUX Pro
  safetyTolerance?: number; // FLUX Pro
  acceleration?: 'none' | 'regular' | 'high'; // FLUX Dev/Schnell
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
 * Generate image using a switch statement to determine parameters by model type
 * Pure switch-statement approach with fully inlined fal.subscribe calls
 */
export async function generateImageWithProvider(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const modelId = getTextToImageModelId(params.model);

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
          prompt: params.prompt,
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
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
    }

    case 'sdxl':
    case 'sdxl_lightning': {
      // SDXL family - shared parameters with model-specific variations
      const defaultSteps = params.model === 'sdxl_lightning' ? 4 : 25;
      const defaultGuidance = params.model === 'sdxl' ? 7.5 : undefined;
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt: params.prompt,
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
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
    }

    case 'imagen4_preview_ultra': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt: params.prompt,
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
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
    }

    case 'nano_banana': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt: params.prompt,
          aspect_ratio: imageSizeToAspectRatio(
            params.imageSize ?? DEFAULT_IMAGE_SIZE
          ),
          ...(params.numImages !== undefined && {
            num_images: params.numImages,
          }),
          ...(params.outputFormat && { output_format: params.outputFormat }),
          sync_mode: false,
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
    }

    case 'recraft_v3': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt: params.prompt,
          image_size: params.imageSize ?? DEFAULT_IMAGE_SIZE,
          style: params.style ?? 'realistic_image',
          enable_safety_checker: false, // Default false for Recraft
          ...(params.colors &&
            params.colors.length > 0 && { colors: params.colors }),
        },
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
    }

    case 'hidream_i1_full': {
      const resp = await fal.subscribe(modelId, {
        input: {
          prompt: params.prompt,
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
      });
      if (!resp.data) throw new Error('No data returned from FAL');
      return resultByProvider(params.model, params, resp.data);
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
          prompt: params.prompt,
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
        console.log('imageStatus', imageDto.status, imageDto.progress);
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
      return resultByProvider(params.model, params, imageDto);
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = params.model;
      throw new Error(`Unsupported model: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Parse result by provider
 */
function resultByProvider(
  model: string,
  params: ImageGenerationParams,
  resp: unknown
): ImageGenerationResult {
  const result = {
    imageUrls: [] as string[],
    parameters: params,
    generatedAt: new Date().toISOString(),
    processingTimeMs: 0,
    provider: model === 'letzai' ? ('letzai' as const) : ('fal' as const),
    metadata: {
      prompt: (resp as { prompt?: string }).prompt || params.prompt,
      model,
      dimensions: [] as { width: number; height: number }[],
      file_sizes: [] as number[],
      seed: (resp as { seed?: number }).seed,
      has_nsfw_concepts: (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts,
      cost: (resp as { cost?: number }).cost,
      requestId: (resp as { requestId?: string }).requestId,
    },
  };

  if (model === 'letzai') {
    const letzaiResp = resp as ImageDto;

    // Get dimensions from model config preset (LetzAI response doesn't include dimensions)
    const presetDims = {
      square_hd: { width: 1024, height: 1024 },
      portrait_16_9: { width: 576, height: 1024 },
      landscape_16_9: { width: 1600, height: 900 },
    }[params.imageSize ?? DEFAULT_IMAGE_SIZE];

    result.imageUrls = [letzaiResp.imageVersions?.original as string];
    result.processingTimeMs = 0; // LetzAI response doesn't include timing info
    result.metadata.dimensions = [
      {
        width: presetDims.width,
        height: presetDims.height,
      },
    ];
  } else {
    const falResp = resp as {
      images?: Array<{
        url: string;
        width?: number;
        height?: number;
        file_size?: number;
      }>;
      timings?: { inference?: number };
      seed?: number;
      has_nsfw_concepts?: boolean[];
    };
    const images = falResp.images;
    const timings = falResp.timings;
    const latencyMs = (resp as { latencyMs?: number }).latencyMs;

    result.imageUrls = Array.isArray(images)
      ? images.map((img) => img.url)
      : [];
    result.processingTimeMs = timings?.inference || latencyMs || 0;
    result.metadata.dimensions = Array.isArray(images)
      ? images.map((img) => ({
          width: img.width ?? 0,
          height: img.height ?? 0,
        }))
      : [];
    result.metadata.file_sizes = Array.isArray(images)
      ? images.map((img) => img.file_size ?? 0)
      : [];
    result.metadata.seed = falResp.seed;
    result.metadata.has_nsfw_concepts = falResp.has_nsfw_concepts;
  }

  return result;
}
