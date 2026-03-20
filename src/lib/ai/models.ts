/**
 * FAL AI model definitions
 * Separated to avoid circular dependencies between service and client modules
 */

import type { AnalysisModelId } from '@/lib/ai/models.config';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';

// ============================================================================
// Text (Chat/LLM) Models — OpenRouter
// ============================================================================

/**
 * Valid text model IDs for OpenRouter chat/LLM calls.
 * Derived from our curated SCRIPT_ANALYSIS_MODELS list in models.config.ts.
 * (The @tanstack/ai-openrouter adapter's built-in model list is stale.)
 */
export type TextModel = AnalysisModelId;

/**
 * Image-to-video models (for motion generation)
 * Enriched with capabilities and performance metadata
 */
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
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
      supportedResolutions: ['720p', '1080p'],
      supportedDurations: [8], // Only 8s supported
    },
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
      maxDuration: 8,
      defaultDuration: 8,
      supportedDurations: [4, 6, 8],
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
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
      defaultDuration: 10,
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedDurations: [5, 10], // API only accepts "5" or "10" as string enum
      requiresStringDuration: true, // API expects string, not number
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[], // Uses input image aspect ratio
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
      maxDuration: 12,
      defaultDuration: 4,
      supportedDurations: [4, 8, 12],
      fpsRange: { min: 24, max: 60, default: 30 },
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
    },
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
      imageUrlParamName: 'start_image_url' as const, // O1 uses start_image_url instead of image_url
    },
    performance: {
      estimatedGenerationTime: 15,
      quality: 'best',
    },
  },

  kling_v3_pro: {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    name: 'Kling v3 Pro',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: true,
      maxDuration: 15,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 30 },
      supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      requiresStringDuration: true,
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[],
      imageUrlParamName: 'start_image_url' as const,
    },
    performance: {
      estimatedGenerationTime: 20,
      quality: 'best',
    },
  },

  kling_v3_pro_no_audio: {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    name: 'Kling v3 Pro (no Audio)',
    provider: 'kling',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 15,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 30 },
      supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      requiresStringDuration: true,
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[],
      imageUrlParamName: 'start_image_url' as const,
    },
    performance: {
      estimatedGenerationTime: 20,
      quality: 'best',
    },
  },

  grok_imagine_video: {
    id: 'xai/grok-imagine-video/image-to-video',
    name: 'Grok Imagine Video',
    provider: 'xai',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 15,
      defaultDuration: 6,
      fpsRange: { min: 24, max: 24, default: 24 },
      supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      supportedAspectRatios: ['16:9', '9:16', '1:1'] as AspectRatio[],
    },
    performance: {
      estimatedGenerationTime: 20,
      quality: 'best',
    },
  },

  wan_v2_6_flash: {
    id: 'wan/v2.6/image-to-video/flash',
    name: 'Wan 2.6 Flash',
    provider: 'wan',
    capabilities: {
      supportsPrompt: true,
      supportsAudio: false,
      maxDuration: 15,
      defaultDuration: 5,
      fpsRange: { min: 24, max: 30, default: 30 },
      supportedDurations: [5, 10, 15],
      supportedAspectRatios: ['16:9', '9:16'] as AspectRatio[],
    },
    performance: {
      estimatedGenerationTime: 15,
      quality: 'good',
    },
  },
} as const;

/**
 * Available models for image generation with rich metadata
 */
export const IMAGE_MODELS = {
  nano_banana: {
    id: 'fal-ai/nano-banana' as const,
    name: 'Nano Banana',
    provider: 'Fal.ai',
    tier: 'ultra-fast',
    description: 'Fastest generation, good for iteration',
    maxPromptLength: 2000, // ~512 tokens
  },
  nano_banana_pro: {
    id: 'fal-ai/nano-banana-pro' as const,
    name: 'Nano Banana Pro',
    provider: 'Fal.ai',
    tier: 'high quality',
    description:
      "Enhanced realism and typography, Google's latest image generation model",
    maxPromptLength: 50000, // ~12,800 tokens (supports very long prompts)
  },
  nano_banana_2: {
    id: 'fal-ai/nano-banana-2' as const,
    name: 'Nano Banana 2',
    provider: 'Fal.ai',
    tier: 'high quality',
    description: "Google's latest fast image generation and editing model",
    maxPromptLength: 50000,
  },
  flux_schnell: {
    id: 'fal-ai/flux/schnell' as const,
    name: 'Flux Schnell',
    provider: 'Black Forest Labs',
    tier: 'fast',
    description: 'Fast high-quality images',
    maxPromptLength: 1000, // ~256 tokens (Schnell uses shorter prompts)
  },
  flux_dev: {
    id: 'fal-ai/flux/dev' as const,
    name: 'Flux Dev',
    provider: 'Black Forest Labs',
    tier: 'balanced',
    description: 'Balance of speed and quality',
    maxPromptLength: 2000, // ~512 tokens
  },
  flux_pro: {
    id: 'fal-ai/flux-pro' as const,
    name: 'Flux Pro',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Professional quality images',
    maxPromptLength: 2000, // ~512 tokens
  },
  flux_pro_v1_1_ultra: {
    id: 'fal-ai/flux-pro/v1.1-ultra' as const,
    name: 'Flux Pro v1.1 Ultra',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Highest quality Flux model',
    maxPromptLength: 2000, // ~512 tokens
  },
  flux_krea_lora: {
    id: 'fal-ai/flux-krea-lora' as const,
    name: 'Flux Krea LoRA',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Flux with creative LoRA',
    maxPromptLength: 2000, // ~512 tokens
  },
  flux_2: {
    id: 'fal-ai/flux-2' as const,
    name: 'Flux 2',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Enhanced realism, crisper text generation, native editing',
    maxPromptLength: 2000, // ~512 tokens
  },
  sdxl_lightning: {
    id: 'fal-ai/fast-lightning-sdxl' as const,
    name: 'SDXL Lightning',
    provider: 'Stability AI',
    tier: 'fast',
    description: 'Fast SDXL variant',
    maxPromptLength: 1000, // ~256 tokens (SDXL uses CLIP encoder)
  },
  sdxl: {
    id: 'fal-ai/fast-sdxl' as const,
    name: 'SDXL',
    provider: 'Stability AI',
    tier: 'balanced',
    description: 'Stable Diffusion XL',
    maxPromptLength: 1000, // ~256 tokens (SDXL uses CLIP encoder)
  },
  imagen4_preview_ultra: {
    id: 'fal-ai/imagen4/preview/ultra' as const,
    name: 'Imagen 4 Ultra',
    provider: 'Google',
    tier: 'premium',
    description: 'Google latest image model',
    maxPromptLength: 2000, // ~512 tokens
  },
  recraft_v3: {
    id: 'fal-ai/recraft/v3/text-to-image' as const,
    name: 'Recraft v3',
    provider: 'Recraft',
    tier: 'premium',
    description: 'Design-focused generation',
    maxPromptLength: 2000, // ~512 tokens
  },
  hidream_i1_full: {
    id: 'fal-ai/hidream-i1-full' as const,
    name: 'HiDream I1 Full',
    provider: 'HiDream',
    tier: 'premium',
    description: 'High detail rendering',
    maxPromptLength: 2000, // ~512 tokens
  },
  seedream_v4_5: {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image' as const,
    name: 'Seedream 4.5',
    provider: 'ByteDance',
    tier: 'premium',
    description: 'Unified generation and editing, high resolution up to 4K',
    maxPromptLength: 2000, // ~512 tokens
  },
  kling_image_v3: {
    id: 'fal-ai/kling-image/v3/text-to-image' as const,
    name: 'Kling Image v3',
    provider: 'Kling',
    tier: 'balanced',
    description: 'Fast high-quality with face/character control',
    maxPromptLength: 2500,
  },
  flux_2_klein_4b: {
    id: 'fal-ai/flux-2/klein/4b' as const,
    name: 'Flux 2 Klein 4B',
    provider: 'Black Forest Labs',
    tier: 'fast',
    description: 'Ultra-fast lightweight Flux 2',
    maxPromptLength: 2000,
  },
  gpt_image_1_5: {
    id: 'fal-ai/gpt-image-1.5' as const,
    name: 'GPT Image 1.5',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'OpenAI image generation with transparent backgrounds',
    maxPromptLength: 4000,
  },
  grok_imagine_image: {
    id: 'xai/grok-imagine-image' as const,
    name: 'Grok Imagine Image',
    provider: 'xAI',
    tier: 'balanced',
    description: 'xAI image generation with prompt enhancement',
    maxPromptLength: 4000,
  },
  letzai: {
    id: 'letzai/image' as const,
    name: 'LetzAI',
    provider: 'LetzAI',
    tier: 'balanced',
    description: 'Alternative provider',
    maxPromptLength: 2000, // ~512 tokens
  },
} as const;

// Text to image model types
export type TextToImageModel = keyof typeof IMAGE_MODELS;
type ImageModelConfig = (typeof IMAGE_MODELS)[TextToImageModel];
type TextToImageModelId = ImageModelConfig['id'];

export const DEFAULT_IMAGE_MODEL: TextToImageModel = 'nano_banana_2';

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
export function getImageModelDisplayName(modelId: string): string {
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

export const DEFAULT_VIDEO_MODEL: ImageToVideoModel = 'kling_v3_pro';

// Typed list of image-to-video model keys for Zod enum schemas
// This is type-safe because we use satisfies to validate the tuple matches the type
export const IMAGE_TO_VIDEO_MODEL_KEYS = [
  'grok_imagine_video',
  'kling_o1',
  'kling_v2_5_turbo_pro',
  'kling_v3_pro',
  'kling_v3_pro_no_audio',
  'seedance_v1_pro',
  'sora_2',
  'veo3',
  'veo3_1',
  'wan_v2_6_flash',
] as const satisfies readonly ImageToVideoModel[];

// Helper to get model ID from key (for backward compatibility)
export function getImageToVideoModelId(
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
// Audio/Music Generation Models
// ============================================================================

/**
 * Audio/music generation models
 * Used for generating background music and sound effects per scene
 */
export const AUDIO_MODELS = {
  ace_step: {
    id: 'fal-ai/ace-step/prompt-to-audio' as const,
    name: 'ACE-Step (Music)',
    provider: 'ace-step',
    type: 'music' as const,
    capabilities: {
      supportsPrompt: true,
      supportsLyrics: true,
      supportsInstrumental: true,
      maxDuration: 240,
      defaultDuration: 60,
      supportedFormats: ['wav'],
    },
    performance: {
      estimatedGenerationTime: 20,
      quality: 'best',
    },
  },

  ace_step_audio_to_audio: {
    id: 'fal-ai/ace-step/audio-to-audio' as const,
    name: 'ACE-Step (Remix)',
    provider: 'ace-step',
    type: 'music' as const,
    capabilities: {
      supportsPrompt: true,
      supportsLyrics: true,
      supportsInstrumental: true,
      supportsAudioInput: true,
      maxDuration: 240,
      defaultDuration: 60,
      supportedFormats: ['wav'],
    },
    performance: {
      estimatedGenerationTime: 20,
      quality: 'best',
    },
  },

  mmaudio_v2: {
    id: 'fal-ai/mmaudio-v2' as const,
    name: 'MMAudio V2 (Video-to-Audio)',
    provider: 'mmaudio',
    type: 'sfx' as const,
    capabilities: {
      supportsPrompt: true,
      supportsVideoInput: true,
      maxDuration: 8,
      defaultDuration: 8,
      supportedFormats: ['wav'],
    },
    performance: {
      estimatedGenerationTime: 10,
      quality: 'good',
    },
  },

  elevenlabs_sfx: {
    id: 'fal-ai/elevenlabs/sound-effects' as const,
    name: 'ElevenLabs Sound Effects',
    provider: 'elevenlabs',
    type: 'sfx' as const,
    capabilities: {
      supportsPrompt: true,
      maxDuration: 22,
      defaultDuration: 5,
      supportedFormats: ['mp3'],
    },
    performance: {
      estimatedGenerationTime: 5,
      quality: 'good',
    },
  },

  elevenlabs_music: {
    id: 'fal-ai/elevenlabs/music' as const,
    name: 'ElevenLabs Music',
    provider: 'elevenlabs-music',
    type: 'music' as const,
    capabilities: {
      supportsPrompt: true,
      supportsInstrumental: true,
      maxDuration: 600,
      defaultDuration: 60,
      supportedFormats: ['mp3'],
    },
    performance: {
      estimatedGenerationTime: 30,
      quality: 'best',
    },
  },

  beatoven_music: {
    id: 'beatoven/music-generation' as const,
    name: 'Beatoven Music',
    provider: 'beatoven',
    type: 'music' as const,
    capabilities: {
      supportsPrompt: true,
      maxDuration: 150,
      defaultDuration: 90,
      supportedFormats: ['wav'],
    },
    performance: {
      estimatedGenerationTime: 25,
      quality: 'good',
    },
  },
} as const;

// Audio model types
export type AudioModel = keyof typeof AUDIO_MODELS;
export type AudioModelConfig = (typeof AUDIO_MODELS)[AudioModel];
type AudioModelId = AudioModelConfig['id'];

export const DEFAULT_MUSIC_MODEL: AudioModel = 'elevenlabs_music';

export const AUDIO_MODEL_KEYS = [
  'ace_step',
  'ace_step_audio_to_audio',
  'beatoven_music',
  'elevenlabs_music',
  'elevenlabs_sfx',
  'mmaudio_v2',
] as const satisfies readonly AudioModel[];

export function getAudioModelId(modelKey: AudioModel): AudioModelId {
  return AUDIO_MODELS[modelKey].id;
}

export function isValidAudioModel(value: unknown): value is AudioModel {
  return typeof value === 'string' && Object.keys(AUDIO_MODELS).includes(value);
}

export function getAudioModelDurationLimits(model: AudioModel) {
  const config = AUDIO_MODELS[model];
  return {
    max: config.capabilities.maxDuration,
    default: config.capabilities.defaultDuration,
  };
}

export function safeAudioModel(
  value: string | null | undefined,
  fallback: AudioModel = DEFAULT_MUSIC_MODEL
): AudioModel {
  if (!value || !isValidAudioModel(value)) {
    if (value) {
      console.warn(
        `[models] Invalid AudioModel "${value}", using fallback "${fallback}"`
      );
    }
    return fallback;
  }
  return value;
}

// ============================================================================
// Edit Endpoint Support (for reference image generation)
// ============================================================================

/**
 * Map text-to-image models to their edit endpoints (if available)
 * These endpoints accept image_urls for reference-based generation
 */
export const EDIT_ENDPOINTS: Partial<Record<TextToImageModel, string>> = {
  nano_banana_pro: 'fal-ai/nano-banana-pro/edit',
  nano_banana_2: 'fal-ai/nano-banana-2/edit',
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
export function supportsReferenceImages(model: TextToImageModel): boolean {
  return model in EDIT_ENDPOINTS;
}
