/**
 * FAL AI model definitions
 * Separated to avoid circular dependencies between service and client modules
 */

import type { AspectRatio } from '@/lib/constants/aspect-ratios';

/**
 * Text-to-video models
 */
const TEXT_TO_VIDEO_MODELS = {
  minimax_hailuo: 'fal-ai/minimax-video/text-to-video',
  mochi_v1: 'fal-ai/mochi-v1/text-to-video',
  luma_dream_machine: 'fal-ai/luma-dream-machine',
  kling_v2: 'fal-ai/kling-video-v1-5/standard/text-to-video',
} as const;

/**
 * Image-to-video models (for motion generation)
 * Enriched with capabilities, pricing, and performance metadata
 */
/**
 * Video pricing unit types - all Fal video models use per-second pricing
 */
type VideoPricingUnit = 'seconds';

type VideoModelPricing = {
  pricePerSecond: number;
  currency: 'USD';
  unit: VideoPricingUnit;
};

export const IMAGE_TO_VIDEO_MODELS = {
  // Premium models - highest quality
  seedance_v1_pro: {
    id: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    name: 'Premium Motion (Seedance Pro)',
    provider: 'seedance',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 12,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 24 }, // Fixed at 24fps per docs
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[],
      supportedResolutions: ['480p', '720p', '1080p'],
      supportedDurations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    pricing: {
      pricePerSecond: 0.5, // API reports "1m tokens" but effectively ~$0.50/sec based on typical usage
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 12,
      quality: 'best',
    },
  },

  veo3: {
    id: 'fal-ai/veo3',
    name: 'Ultra Premium Motion with Audio (Google Veo 3)',
    provider: 'google',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 8,
      defaultDuration: 8,
      fpsRange: { min: 24, max: 30, default: 24 }, // Fixed FPS
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[],
      supportedResolutions: ['720p', '1080p'],
      supportedDurations: [8], // Only 8s supported
    },
    pricing: {
      pricePerSecond: 0.4,
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 25,
      quality: 'best',
    },
  },

  // Latest models - cutting edge
  veo3_1: {
    id: 'fal-ai/veo3.1/image-to-video',
    name: 'Google Veo 3.1',
    provider: 'google',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 12,
      defaultDuration: 10,
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
    },
    pricing: {
      pricePerSecond: 0.4, // Same as veo3 per Fal API
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 25,
      quality: 'best',
    },
  },

  kling_v2_5_turbo_pro: {
    id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    name: 'Kling v2.5 Turbo Pro',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 10,
      defaultDuration: 10,
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedDurations: [5, 10], // API only accepts "5" or "10" as string enum
      requiresStringDuration: true, // API expects string, not number
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[], // Uses input image aspect ratio
    },
    pricing: {
      pricePerSecond: 0.07,
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 15,
      quality: 'best',
    },
  },

  kling_v2_6_pro: {
    id: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    name: 'Kling v2.6 Pro (with Audio)',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true, // Native audio generation (Chinese/English)
      maxDuration: 10,
      defaultDuration: 10,
      fpsRange: { min: 24, max: 30, default: 30 },
      supportedDurations: [5, 10], // API only accepts "5" or "10" as string enum
      requiresStringDuration: true, // API expects string, not number
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[], // Uses input image aspect ratio
    },
    pricing: {
      pricePerSecond: 0.07,
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 15,
      quality: 'best',
    },
  },

  sora_2: {
    id: 'fal-ai/sora-2/image-to-video',
    name: 'OpenAI Sora 2',
    provider: 'openai',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 10,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
    },
    pricing: {
      pricePerSecond: 0.1,
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 30,
      quality: 'best',
    },
  },

  kling_o1: {
    id: 'fal-ai/kling-video/o1/image-to-video',
    name: 'Kling O1 (Omni)',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 10,
      defaultDuration: 10,
      fpsRange: { min: 24, max: 30, default: 30 }, // Standard for Kling models
      supportedDurations: [5, 10], // API only accepts "5" or "10" as string enum
      requiresStringDuration: true, // API expects string, not number
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[], // Uses input image aspect ratio
    },
    pricing: {
      pricePerSecond: 0.112,
      currency: 'USD',
      unit: 'seconds',
    } as VideoModelPricing,
    performance: {
      estimatedGenerationTime: 15,
      quality: 'best',
    },
  },
} as const;

/**
 * All video models combined (for backward compatibility - returns model IDs)
 * @deprecated Use IMAGE_TO_VIDEO_MODELS directly for full metadata
 */
const VIDEO_MODELS = {
  ...TEXT_TO_VIDEO_MODELS,
  // Extract just the IDs for backward compatibility
  seedance_v1_pro: IMAGE_TO_VIDEO_MODELS.seedance_v1_pro.id,
  veo3: IMAGE_TO_VIDEO_MODELS.veo3.id,
  veo3_1: IMAGE_TO_VIDEO_MODELS.veo3_1.id,
  kling_v2_5_turbo_pro: IMAGE_TO_VIDEO_MODELS.kling_v2_5_turbo_pro.id,
  kling_v2_6_pro: IMAGE_TO_VIDEO_MODELS.kling_v2_6_pro.id,
  sora_2: IMAGE_TO_VIDEO_MODELS.sora_2.id,
  kling_o1: IMAGE_TO_VIDEO_MODELS.kling_o1.id,
} as const;

/**
 * Available models for image generation with rich metadata
 */
/**
 * Pricing unit types for Fal.ai models
 */
type ImagePricingUnit = 'images' | 'megapixels' | 'compute_seconds';

type ImageModelPricing = {
  price: number;
  unit: ImagePricingUnit;
  currency: 'USD';
};

export const IMAGE_MODELS = {
  nano_banana: {
    id: 'fal-ai/nano-banana' as const,
    name: 'Nano Banana',
    provider: 'Fal.ai',
    tier: 'ultra-fast',
    description: 'Fastest generation, good for iteration',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.0398,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  nano_banana_pro: {
    id: 'fal-ai/nano-banana-pro' as const,
    name: 'Nano Banana Pro',
    provider: 'Fal.ai',
    tier: 'high quality',
    description:
      "Enhanced realism and typography, Google's latest image generation model",
    maxPromptLength: 50000, // ~12,800 tokens (supports very long prompts)
    pricing: {
      price: 0.15,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_schnell: {
    id: 'fal-ai/flux/schnell' as const,
    name: 'Flux Schnell',
    provider: 'Black Forest Labs',
    tier: 'fast',
    description: 'Fast high-quality images',
    maxPromptLength: 1000, // ~256 tokens (Schnell uses shorter prompts)
    pricing: {
      price: 0.003,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_dev: {
    id: 'fal-ai/flux/dev' as const,
    name: 'Flux Dev',
    provider: 'Black Forest Labs',
    tier: 'balanced',
    description: 'Balance of speed and quality',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.025,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_pro: {
    id: 'fal-ai/flux-pro' as const,
    name: 'Flux Pro',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Professional quality images',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.05,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_pro_v1_1_ultra: {
    id: 'fal-ai/flux-pro/v1.1-ultra' as const,
    name: 'Flux Pro v1.1 Ultra',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Highest quality Flux model',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.06,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_krea_lora: {
    id: 'fal-ai/flux-krea-lora' as const,
    name: 'Flux Krea LoRA',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Flux with creative LoRA',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.035,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  flux_2: {
    id: 'fal-ai/flux-2' as const,
    name: 'Flux 2',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Enhanced realism, crisper text generation, native editing',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.012,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  sdxl_lightning: {
    id: 'fal-ai/fast-lightning-sdxl' as const,
    name: 'SDXL Lightning',
    provider: 'Stability AI',
    tier: 'fast',
    description: 'Fast SDXL variant',
    maxPromptLength: 1000, // ~256 tokens (SDXL uses CLIP encoder)
    pricing: {
      price: 0.00125,
      unit: 'compute_seconds',
      currency: 'USD',
    } as ImageModelPricing,
  },
  sdxl: {
    id: 'fal-ai/fast-sdxl' as const,
    name: 'SDXL',
    provider: 'Stability AI',
    tier: 'balanced',
    description: 'Stable Diffusion XL',
    maxPromptLength: 1000, // ~256 tokens (SDXL uses CLIP encoder)
    pricing: {
      price: 0.00111,
      unit: 'compute_seconds',
      currency: 'USD',
    } as ImageModelPricing,
  },
  imagen4_preview_ultra: {
    id: 'fal-ai/imagen4/preview/ultra' as const,
    name: 'Imagen 4 Ultra',
    provider: 'Google',
    tier: 'premium',
    description: 'Google latest image model',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.06,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  recraft_v3: {
    id: 'fal-ai/recraft/v3/text-to-image' as const,
    name: 'Recraft v3',
    provider: 'Recraft',
    tier: 'premium',
    description: 'Design-focused generation',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.04,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  hidream_i1_full: {
    id: 'fal-ai/hidream-i1-full' as const,
    name: 'HiDream I1 Full',
    provider: 'HiDream',
    tier: 'premium',
    description: 'High detail rendering',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.05,
      unit: 'megapixels',
      currency: 'USD',
    } as ImageModelPricing,
  },
  seedream_v4_5: {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image' as const,
    name: 'Seedream 4.5',
    provider: 'ByteDance',
    tier: 'premium',
    description: 'Unified generation and editing, high resolution up to 4K',
    maxPromptLength: 2000, // ~512 tokens
    pricing: {
      price: 0.04,
      unit: 'images',
      currency: 'USD',
    } as ImageModelPricing,
  },
  letzai: {
    id: 'letzai/image' as const,
    name: 'LetzAI',
    provider: 'LetzAI',
    tier: 'balanced',
    description: 'Alternative provider',
    maxPromptLength: 2000, // ~512 tokens
    pricing: null, // Not a Fal.ai model
  },
} as const;

// Text to image model types
export type TextToImageModel = keyof typeof IMAGE_MODELS;
type ImageModelConfig = (typeof IMAGE_MODELS)[TextToImageModel];
type TextToImageModelId = ImageModelConfig['id'];

export const DEFAULT_IMAGE_MODEL: TextToImageModel = 'nano_banana_pro';

// Helper to get model ID from key
export function getTextToImageModelId(
  modelKey: TextToImageModel
): TextToImageModelId {
  return IMAGE_MODELS[modelKey].id;
}

// Helper to get model config by ID
export function getImageModelById(id: string): ImageModelConfig | undefined {
  return Object.values(IMAGE_MODELS).find((model) => model.id === id);
}

// Helper to get model display name
function getImageModelDisplayName(modelId: string): string {
  const model = getImageModelById(modelId);
  return model?.name ?? modelId;
}

// Image to video model types
export type ImageToVideoModel = keyof typeof IMAGE_TO_VIDEO_MODELS;
// Type for the video model configuration object
export type ImageToVideoModelConfig =
  (typeof IMAGE_TO_VIDEO_MODELS)[ImageToVideoModel];
// Type for the video model ID
type ImageToVideoModelId = ImageToVideoModelConfig['id'];

export const DEFAULT_VIDEO_MODEL: ImageToVideoModel = 'kling_v2_6_pro';

// Helper to get model ID from key (for backward compatibility)
function getImageToVideoModelId(
  modelKey: ImageToVideoModel
): ImageToVideoModelId {
  return IMAGE_TO_VIDEO_MODELS[modelKey].id;
}

/**
 * Runtime validation: Check if a string is a valid TextToImageModel key
 * @param value - String value to validate
 * @returns true if value is a valid model key, false otherwise
 */
export function isValidTextToImageModel(
  value: unknown
): value is TextToImageModel {
  return typeof value === 'string' && Object.keys(IMAGE_MODELS).includes(value);
}

/**
 * Runtime validation: Check if a string is a valid ImageToVideoModel key
 * @param value - String value to validate
 * @returns true if value is a valid model key, false otherwise
 */
export function isValidImageToVideoModel(
  value: unknown
): value is ImageToVideoModel {
  return (
    typeof value === 'string' &&
    Object.keys(IMAGE_TO_VIDEO_MODELS).includes(value)
  );
}

/**
 * Safely cast database string to TextToImageModel with validation
 * Falls back to default if invalid
 * @param value - Database string value (potentially invalid)
 * @param fallback - Default value to use if invalid (defaults to DEFAULT_IMAGE_MODEL)
 * @returns Valid TextToImageModel
 */
export function safeTextToImageModel(
  value: string | null | undefined,
  fallback: TextToImageModel = DEFAULT_IMAGE_MODEL
): TextToImageModel {
  if (!value || !isValidTextToImageModel(value)) {
    if (value) {
      console.warn(
        `[models] Invalid TextToImageModel "${value}", using fallback "${fallback}"`
      );
    }
    return fallback;
  }
  return value;
}

/**
 * Safely cast database string to ImageToVideoModel with validation
 * Falls back to default if invalid
 * @param value - Database string value (potentially invalid)
 * @param fallback - Default value to use if invalid (defaults to DEFAULT_VIDEO_MODEL)
 * @returns Valid ImageToVideoModel
 */
export function safeImageToVideoModel(
  value: string | null | undefined,
  fallback: ImageToVideoModel = DEFAULT_VIDEO_MODEL
): ImageToVideoModel {
  if (!value || !isValidImageToVideoModel(value)) {
    if (value) {
      console.warn(
        `[models] Invalid ImageToVideoModel "${value}", using fallback "${fallback}"`
      );
    }
    return fallback;
  }
  return value;
}

/**
 * Check if a video model supports a specific aspect ratio
 * @param model - The video model key to check
 * @param aspectRatio - The aspect ratio to check for
 * @returns true if the model supports the aspect ratio
 */
export function isModelCompatibleWithAspectRatio(
  model: ImageToVideoModel,
  aspectRatio: AspectRatio
): boolean {
  const config = IMAGE_TO_VIDEO_MODELS[model];
  const supported = config.capabilities.supportedAspectRatios;
  // If supportedAspectRatios is not defined, assume all are supported
  return !supported || supported.includes(aspectRatio);
}

/**
 * Get all video models that support a specific aspect ratio
 * @param aspectRatio - The aspect ratio to filter by
 * @returns Array of compatible model keys
 */
function getModelsForAspectRatio(
  aspectRatio: AspectRatio
): ImageToVideoModel[] {
  return Object.keys(IMAGE_TO_VIDEO_MODELS).filter(
    (key): key is ImageToVideoModel =>
      isValidImageToVideoModel(key) &&
      isModelCompatibleWithAspectRatio(key, aspectRatio)
  );
}

/**
 * Get a compatible video model for an aspect ratio, falling back if needed
 * @param currentModel - The currently selected model
 * @param aspectRatio - The target aspect ratio
 * @returns The current model if compatible, otherwise a compatible fallback
 */
export function getCompatibleModel(
  currentModel: ImageToVideoModel,
  aspectRatio: AspectRatio
): ImageToVideoModel {
  if (isModelCompatibleWithAspectRatio(currentModel, aspectRatio)) {
    return currentModel;
  }
  // Try default first
  if (isModelCompatibleWithAspectRatio(DEFAULT_VIDEO_MODEL, aspectRatio)) {
    return DEFAULT_VIDEO_MODEL;
  }
  // Fall back to first compatible model
  const compatible = getModelsForAspectRatio(aspectRatio);
  return compatible[0] ?? DEFAULT_VIDEO_MODEL;
}

// ============================================================================
// Edit Endpoint Support (for reference image generation)
// ============================================================================

/**
 * Map text-to-image models to their edit endpoints (if available)
 * These endpoints accept image_urls for reference-based generation
 */
const EDIT_ENDPOINTS: Partial<Record<TextToImageModel, string>> = {
  nano_banana_pro: 'fal-ai/nano-banana-pro/edit',
  // Add other models with edit support here as they become available
};

/**
 * Get the edit endpoint for a model that supports reference images
 * @param model - The text-to-image model key
 * @returns The Fal.ai edit endpoint ID, or null if not supported
 */
export function getEditEndpoint(model: TextToImageModel): string | null {
  return EDIT_ENDPOINTS[model] ?? null;
}

/**
 * Check if a model supports reference images via an edit endpoint
 * @param model - The text-to-image model key
 * @returns true if the model has an edit endpoint for reference images
 */
function supportsReferenceImages(model: TextToImageModel): boolean {
  return model in EDIT_ENDPOINTS;
}
