import {
  type FalImageGenerationParams,
  type FalImageResponse,
} from '@/lib/ai/fal-client';
import type { LetzAIMode } from '@/lib/ai/letzai-client';
import { generateImage as generateImageLetzAI } from '@/lib/ai/letzai-client';
import {
  AI_PROVIDER_MAPPINGS,
  getTextToImageModelId,
  TextToImageModel,
} from '@/lib/ai/models';
import {
  DEFAULT_IMAGE_SIZE,
  type ImageSize,
} from '@/lib/constants/aspect-ratios';
import type {
  LetzAIImageRequest,
  LetzAIImageResponse,
} from '@/lib/schemas/letzai-request';

import { fal } from '@fal-ai/client';

const LETZAI_PRESET_DIMENSIONS: Record<
  ImageSize,
  { width: number; height: number }
> = {
  square_hd: { width: 1024, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_16_9: { width: 1600, height: 900 },
} as const;

/**
 * Parameters for image generation
 */
export type ImageGenerationParams = {
  model: TextToImageModel;
  prompt: string;
  imageSize?: ImageSize;
  numImages?: number;
  seed?: number;
  quality?: number;
  creativity?: number;
  hasWatermark?: boolean;
  systemVersion?: number;
  mode?: LetzAIMode;
};
/**
 * Select AI provider based on model
 */
export async function generateImageWithProvider(params: ImageGenerationParams) {
  switch (params.model) {
    case 'letzai': {
      const { width, height } = LETZAI_PRESET_DIMENSIONS[
        params.imageSize ?? DEFAULT_IMAGE_SIZE
      ] ?? {
        width: 1600,
        height: 900,
      };
      const letzaiPayload: LetzAIImageRequest = {
        prompt: params.prompt,
        width,
        height,
        quality: params.quality ?? 5,
        creativity: params.creativity ?? 2,
        hasWatermark: params.hasWatermark ?? false,
        systemVersion: params.systemVersion ?? 3,
        mode: params.mode ?? 'cinematic',
      };
      const resp = await generateImageLetzAI(letzaiPayload);
      if (!resp.data) {
        throw new Error('No data returned from LetzAI');
      }
      return resultByProvider(
        params.model,
        params,
        resp.data as LetzAIImageResponse
      );
    }
    default: {
      // For FAL, convert our params to their expected format
      const falParams: FalImageGenerationParams = {
        model: getTextToImageModelId(params.model),
        prompt: params.prompt,
        image_size: params.imageSize,
        num_images: params.numImages,
        seed: params.seed,
      };
      const resp = await fal.subscribe(getTextToImageModelId(params.model), {
        input: {
          prompt: params.prompt,
        },
      });
      if (!resp.data) {
        throw new Error('No data returned from FAL');
      }
      return resultByProvider(
        params.model,
        params,
        resp.data as FalImageResponse
      );
    }
  }
}

/**
 * Parse result by provider
 */
function resultByProvider(
  model: string,
  params: ImageGenerationParams,
  resp: FalImageResponse | LetzAIImageResponse
) {
  const result = {
    imageUrls: [] as string[],
    parameters: params,
    generatedAt: new Date().toISOString(),
    processingTimeMs: 0,
    provider: AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS],
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

  switch (AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS]) {
    case 'letz-ai': {
      const generationSettings =
        (resp as { generationSettings?: Record<string, number> })
          .generationSettings ?? ({} as Record<string, number>);

      // Get dimensions from preset
      const presetDims = params.imageSize
        ? LETZAI_PRESET_DIMENSIONS[params.imageSize]
        : LETZAI_PRESET_DIMENSIONS.landscape_16_9;

      result.imageUrls = [
        (resp as { imageVersions?: { original: string } }).imageVersions
          ?.original as string,
      ];
      result.processingTimeMs = (resp as { latencyMs?: number }).latencyMs || 0;
      result.metadata.dimensions = [
        {
          width: generationSettings.width ?? presetDims.width,
          height: generationSettings.height ?? presetDims.height,
        },
      ];
      break;
    }
    default: {
      const images = (
        resp as {
          images?: {
            url: string;
            width?: number;
            height?: number;
            file_size?: number;
          }[];
        }
      ).images;
      const timings = (resp as { timings?: { inference?: number } }).timings;
      const latencyMs = (resp as { latencyMs?: number }).latencyMs;
      const seed = (resp as { seed?: number }).seed;
      const has_nsfw_concepts = (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts;

      result.imageUrls = Array.isArray(images)
        ? images.map((img: { url: string }) => img.url)
        : ([] as string[]);
      result.processingTimeMs = timings?.inference || latencyMs || 0;
      result.metadata.dimensions = Array.isArray(images)
        ? images.map((img: { width?: number; height?: number }) => ({
            width: img.width ?? 0,
            height: img.height ?? 0,
          }))
        : ([] as { width: number; height: number }[]);
      result.metadata.file_sizes = Array.isArray(images)
        ? images.map((img: { file_size?: number }) => img.file_size ?? 0)
        : ([] as number[]);
      result.metadata.seed = seed;
      result.metadata.has_nsfw_concepts = has_nsfw_concepts;
      break;
    }
  }

  return result;
}
