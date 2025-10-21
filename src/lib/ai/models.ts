/**
 * FAL AI model definitions
 * Separated to avoid circular dependencies between service and client modules
 */

/**
 * Text-to-video models
 */
export const TEXT_TO_VIDEO_MODELS = {
  minimax_hailuo: "fal-ai/minimax-video/text-to-video",
  mochi_v1: "fal-ai/mochi-v1/text-to-video",
  luma_dream_machine: "fal-ai/luma-dream-machine",
  kling_v2: "fal-ai/kling-video-v1-5/standard/text-to-video",
} as const;

/**
 * Image-to-video models (for motion generation)
 */
export const IMAGE_TO_VIDEO_MODELS = {
  wan_i2v: "fal-ai/wan-i2v",
  kling_i2v: "fal-ai/kling-video-v1-5/standard/image-to-video",
  svd_lcm: "fal-ai/fast-svd-lcm",
  seedance_v1_pro: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
  veo2_i2v: "fal-ai/veo2/image-to-video", // Google Veo 2
  veo3: "fal-ai/veo3", // Google Veo 3 with audio (supports both text-to-video and image-to-video)
  wan_v2: "fal-ai/wan-v2-2-a14b", // WAN 2.2 cinematic quality
} as const;

/**
 * All video models combined
 */
export const VIDEO_MODELS = {
  ...TEXT_TO_VIDEO_MODELS,
  ...IMAGE_TO_VIDEO_MODELS,
} as const;

/**
 * Available FAL models for image generation
 */
export const IMAGE_MODELS = {
  flux_pro: "fal-ai/flux-pro",
  flux_dev: "fal-ai/flux/dev",
  flux_schnell: "fal-ai/flux/schnell",
  sdxl: "fal-ai/fast-sdxl",
  sdxl_lightning: "fal-ai/fast-lightning-sdxl",
  flux_pro_kontext_max: "fal-ai/flux-pro/kontext/max", // https://fal.ai/models/fal-ai/flux-pro/kontext/max/api#api-call-install
  imagen4_preview_ultra: "fal-ai/imagen4/preview/ultra", // https://fal.ai/models/fal-ai/imagen4/preview/ultra/api#api-call-install
  flux_pro_v1_1_ultra: "fal-ai/flux-pro/v1.1-ultra", // https://fal.ai/models/fal-ai/flux-pro/v1.1-ultra/api#api-call-install
  flux_krea_lora: "fal-ai/flux-krea-lora", // https://fal.ai/models/fal-ai/flux-krea-lora/api#api-call-install
  letzai: "letzai/image",
} as const;

/**
 * AI provider mappings
 */
export const AI_PROVIDER_MAPPINGS = {
  flux_pro: "fal-ai",
  flux_dev: "fal-ai",
  flux_schnell: "fal-ai",
  sdxl: "fal-ai",
  sdxl_lightning: "fal-ai",
  flux_pro_kontext_max: "fal-ai",
  imagen4_preview_ultra: "fal-ai",
  flux_pro_v1_1_ultra: "fal-ai",
  flux_krea_lora: "fal-ai",
  letzai: "letz-ai",
} as const;

export type FalVideoModel = (typeof VIDEO_MODELS)[keyof typeof VIDEO_MODELS];
export type FalImageModel = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];
