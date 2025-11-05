/**
 * FAL AI model definitions
 * Separated to avoid circular dependencies between service and client modules
 */

/**
 * Text-to-video models
 */
export const TEXT_TO_VIDEO_MODELS = {
  minimax_hailuo: 'fal-ai/minimax-video/text-to-video',
  mochi_v1: 'fal-ai/mochi-v1/text-to-video',
  luma_dream_machine: 'fal-ai/luma-dream-machine',
  kling_v2: 'fal-ai/kling-video-v1-5/standard/text-to-video',
} as const;

/**
 * Image-to-video models (for motion generation)
 * Enriched with capabilities, pricing, and performance metadata
 */
export const IMAGE_TO_VIDEO_MODELS = {
  // Fast models - optimized for speed
  svd_lcm: {
    id: 'fal-ai/fast-svd-lcm',
    name: 'Fast Motion (SVD-LCM)',
    provider: 'stability',
    capabilities: {
      supportsPrompt: false, // Uses motion_bucket_id instead
      supportsAudio: false,
      maxDuration: 2.5, // 25 frames total
      defaultDuration: 2.5,
      fpsRange: { min: 1, max: 25, default: 10 }, // API allows 1-25 fps
      fixedFrameCount: 25, // Always generates 25 frames
    },
    pricing: {
      estimatedCost: 0.1,
      unit: 'frame',
    },
    performance: {
      estimatedGenerationTime: 5, // seconds
      quality: 'good',
    },
  },

  // Balanced models - good quality/speed ratio
  wan_i2v: {
    id: 'fal-ai/wan-i2v',
    name: 'Balanced Motion (WAN 2.1)',
    provider: 'minimax',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 6.25, // 100 frames at 16fps
      defaultDuration: 5.06, // 81 frames at 16fps (default)
      fpsRange: { min: 5, max: 24, default: 16 }, // API: 5-24 fps, default 16
      supportedResolutions: ['480p', '720p'],
      supportedAspectRatios: ['auto', '16:9', '9:16', '1:1'],
    },
    pricing: {
      estimatedCost: 0.3,
      unit: 'frame',
    },
    performance: {
      estimatedGenerationTime: 10,
      quality: 'better',
    },
  },

  kling_i2v: {
    id: 'fal-ai/kling-video-v1-5/standard/image-to-video',
    name: 'High Quality Motion (Kling I2V v1.5)',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 10,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 60, default: 30 },
    },
    pricing: {
      estimatedCost: 0.4,
      unit: 'frame',
    },
    performance: {
      estimatedGenerationTime: 15,
      quality: 'better',
    },
  },

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
      supportedAspectRatios: [
        '21:9',
        '16:9',
        '4:3',
        '1:1',
        '3:4',
        '9:16',
        'auto',
      ],
      supportedResolutions: ['480p', '720p', '1080p'],
      supportedDurations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    pricing: {
      estimatedCost: 0.5,
      unit: 'frame',
    },
    performance: {
      estimatedGenerationTime: 12,
      quality: 'best',
    },
  },

  veo2_i2v: {
    id: 'fal-ai/veo2/image-to-video',
    name: 'Ultra Premium Motion (Google Veo 2)',
    provider: 'google',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 8,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 24 }, // Fixed at 720p output
      supportedAspectRatios: ['auto', 'auto_prefer_portrait', '16:9', '9:16'],
      supportedDurations: [5, 6, 7, 8],
      fixedResolution: '720p',
    },
    pricing: {
      estimatedCost: 0.8,
      unit: 'second',
    },
    performance: {
      estimatedGenerationTime: 20,
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
      supportedAspectRatios: ['auto', '9:16', '16:9', '1:1'],
      supportedResolutions: ['720p', '1080p'],
      supportedDurations: [8], // Only 8s supported
    },
    pricing: {
      estimatedCost: 1.0,
      unit: 'second',
    },
    performance: {
      estimatedGenerationTime: 25,
      quality: 'best',
    },
  },

  wan_v2: {
    id: 'fal-ai/wan-v2-2-a14b',
    name: 'Cinematic Quality Motion (WAN 2.2)',
    provider: 'minimax',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 10,
      defaultDuration: 6,
      fpsRange: { min: 24, max: 60, default: 30 },
    },
    pricing: {
      estimatedCost: 0.7,
      unit: 'frame',
    },
    performance: {
      estimatedGenerationTime: 18,
      quality: 'best',
    },
  },

  // Latest models - cutting edge
  veo3_1: {
    id: 'fal-ai/veo3.1/reference-to-video',
    name: 'Latest Google Veo 3.1',
    provider: 'google',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 12,
      defaultDuration: 10,
      fpsRange: { min: 24, max: 60, default: 30 },
    },
    pricing: {
      estimatedCost: 0.2, // $0.20/sec without audio, $0.40/sec with audio
      unit: 'second',
    },
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
      defaultDuration: 5,
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedDurations: [5, 10], // API only accepts "5" or "10" as string enum
      requiresStringDuration: true, // API expects string, not number
    },
    pricing: {
      estimatedCost: 0.35, // $0.35 for 5s + $0.07/s
      unit: 'video',
    },
    performance: {
      estimatedGenerationTime: 15,
      quality: 'best',
    },
  },

  wan_2_5: {
    id: 'fal-ai/wan-25-preview/image-to-video',
    name: 'WAN 2.5 Preview',
    provider: 'minimax',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 10,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 30 }, // Fixed FPS at 30
      supportedResolutions: ['480p', '720p', '1080p'],
      supportedDurations: [5, 10],
    },
    pricing: {
      estimatedCost: 0.1, // $0.05-$0.15/s depending on resolution
      unit: 'second',
    },
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
    },
    pricing: {
      estimatedCost: 1.5, // Estimated, subject to OpenAI pricing
      unit: 'video',
    },
    performance: {
      estimatedGenerationTime: 30,
      quality: 'best',
    },
  },
} as const;

/**
 * All video models combined (for backward compatibility - returns model IDs)
 * @deprecated Use IMAGE_TO_VIDEO_MODELS directly for full metadata
 */
export const VIDEO_MODELS = {
  ...TEXT_TO_VIDEO_MODELS,
  // Extract just the IDs for backward compatibility
  svd_lcm: IMAGE_TO_VIDEO_MODELS.svd_lcm.id,
  wan_i2v: IMAGE_TO_VIDEO_MODELS.wan_i2v.id,
  kling_i2v: IMAGE_TO_VIDEO_MODELS.kling_i2v.id,
  seedance_v1_pro: IMAGE_TO_VIDEO_MODELS.seedance_v1_pro.id,
  veo2_i2v: IMAGE_TO_VIDEO_MODELS.veo2_i2v.id,
  veo3: IMAGE_TO_VIDEO_MODELS.veo3.id,
  wan_v2: IMAGE_TO_VIDEO_MODELS.wan_v2.id,
  veo3_1: IMAGE_TO_VIDEO_MODELS.veo3_1.id,
  kling_v2_5_turbo_pro: IMAGE_TO_VIDEO_MODELS.kling_v2_5_turbo_pro.id,
  wan_2_5: IMAGE_TO_VIDEO_MODELS.wan_2_5.id,
  sora_2: IMAGE_TO_VIDEO_MODELS.sora_2.id,
} as const;

/**
 * Available FAL models for image generation
 */
export const IMAGE_MODELS = {
  flux_pro: 'fal-ai/flux-pro',
  flux_dev: 'fal-ai/flux/dev',
  flux_schnell: 'fal-ai/flux/schnell',
  sdxl: 'fal-ai/fast-sdxl',
  sdxl_lightning: 'fal-ai/fast-lightning-sdxl',
  flux_pro_kontext_max: 'fal-ai/flux-pro/kontext/max', // https://fal.ai/models/fal-ai/flux-pro/kontext/max/api#api-call-install
  imagen4_preview_ultra: 'fal-ai/imagen4/preview/ultra', // https://fal.ai/models/fal-ai/imagen4/preview/ultra/api#api-call-install
  flux_pro_v1_1_ultra: 'fal-ai/flux-pro/v1.1-ultra', // https://fal.ai/models/fal-ai/flux-pro/v1.1-ultra/api#api-call-install
  flux_krea_lora: 'fal-ai/flux-krea-lora', // https://fal.ai/models/fal-ai/flux-krea-lora/api#api-call-install
  nano_banana: 'fal-ai/nano-banana', // https://fal.ai/models/fal-ai/nano-banana
  recraft_v3: 'fal-ai/recraft/v3/text-to-image', // https://fal.ai/models/fal-ai/recraft/v3/text-to-image
  hidream_i1_full: 'fal-ai/hidream-i1-full', // https://fal.ai/models/fal-ai/hidream-i1-full
  letzai: 'letzai/image',
} as const;

/**
 * AI provider mappings
 */
export const AI_PROVIDER_MAPPINGS = {
  flux_pro: 'fal-ai',
  flux_dev: 'fal-ai',
  flux_schnell: 'fal-ai',
  sdxl: 'fal-ai',
  sdxl_lightning: 'fal-ai',
  flux_pro_kontext_max: 'fal-ai',
  imagen4_preview_ultra: 'fal-ai',
  flux_pro_v1_1_ultra: 'fal-ai',
  flux_krea_lora: 'fal-ai',
  nano_banana: 'fal-ai',
  recraft_v3: 'fal-ai',
  hidream_i1_full: 'fal-ai',
  letzai: 'letz-ai',
} as const;

// Type for a model configuration object
export type ImageToVideoModelConfig =
  (typeof IMAGE_TO_VIDEO_MODELS)[keyof typeof IMAGE_TO_VIDEO_MODELS];

// Type for model keys
export type ImageToVideoModel = keyof typeof IMAGE_TO_VIDEO_MODELS;

// Helper type to extract model ID strings (for backward compatibility)
export type ImageToVideoModelId = ImageToVideoModelConfig['id'];

export type FalVideoModel = (typeof VIDEO_MODELS)[keyof typeof VIDEO_MODELS];
export type FalImageModel = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];

export const DEFAULT_IMAGE_MODEL: keyof typeof IMAGE_MODELS = 'nano_banana';

export const DEFAULT_VIDEO_MODEL: ImageToVideoModel = 'kling_v2_5_turbo_pro';

// Helper to get model ID from key (for backward compatibility)
export function getModelId(modelKey: ImageToVideoModel): string {
  return IMAGE_TO_VIDEO_MODELS[modelKey].id;
}
