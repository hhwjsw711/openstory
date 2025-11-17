/**
 * Registry of AI models available for script analysis.
 * Easy to extend with additional providers (OpenAI, xAI, Qwen, Meta, etc.)
 */

export const SCRIPT_ANALYSIS_MODELS = [
  {
    id: 'cerebras/qwen-3-235b-a22b-instruct-2507',
    name: 'Qwen 3 235B Instruct',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Very large model, excellent for complex analysis',
  },
  {
    id: 'cerebras/qwen-3-coder-480b',
    name: 'Qwen 3 480B Coder',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Very large model, excellent for complex analysis',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'fast',
    description: 'Quick analysis, lower cost',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    description: 'Detailed analysis, higher quality',
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'xAI',
    tier: 'premium',
    description: 'Fast analysis, higher quality',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'premium',
    description: 'High quality analysis, higher quality',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    tier: 'fast',
    description: 'Fastest analysis, highest quality',
  },
  {
    id: 'openai/gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Fast analysis, highest quality',
  },
  // Cerebras models - ultra-fast inference (1,400-3,000 tokens/second)
  {
    id: 'cerebras/llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Fastest inference (~3,000 tok/s), great for rapid iterations',
  },
  {
    id: 'cerebras/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Balanced speed and quality (~2,200 tok/s)',
  },
  {
    id: 'cerebras/qwen-3-32b',
    name: 'Qwen 3 32B',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'High-quality medium model with excellent speed',
  },
  {
    id: 'cerebras/llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Large model with fast inference (~1,800 tok/s)',
  },
  {
    id: 'cerebras/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'Cerebras',
    tier: 'ultra-fast',
    description: 'Very large model, excellent for complex analysis',
  },
] as const;

export type AnalysisModel = (typeof SCRIPT_ANALYSIS_MODELS)[number];
export type AnalysisModelId = AnalysisModel['id'];

/**
 * Get model by ID
 */
export function getModelById(id: string): AnalysisModel | undefined {
  return SCRIPT_ANALYSIS_MODELS.find((model) => model.id === id);
}

/**
 * Get display name for a model
 */
export function getModelDisplayName(modelId: string): string {
  const model = getModelById(modelId);
  return model?.name ?? modelId;
}

/**
 * Get all model IDs
 */
export function getAllModelIds(): AnalysisModelId[] {
  return SCRIPT_ANALYSIS_MODELS.map((model) => model.id);
}

export const ANALYSIS_MODEL_IDS = getAllModelIds();
/**
 * Default model to use when none is specified
 */
export const DEFAULT_ANALYSIS_MODEL: AnalysisModelId =
  'anthropic/claude-haiku-4.5';

/**
 * Registry of AI models available for image generation.
 * Mapped from IMAGE_MODELS with metadata for UI display.
 */
export const IMAGE_GENERATION_MODELS = [
  {
    id: 'nano_banana' as const,
    name: 'Nano Banana',
    provider: 'Fal.ai',
    tier: 'ultra-fast',
    description: 'Fastest generation, good for iteration',
  },
  {
    id: 'flux_schnell' as const,
    name: 'Flux Schnell',
    provider: 'Black Forest Labs',
    tier: 'fast',
    description: 'Fast high-quality images',
  },
  {
    id: 'flux_dev' as const,
    name: 'Flux Dev',
    provider: 'Black Forest Labs',
    tier: 'balanced',
    description: 'Balance of speed and quality',
  },
  {
    id: 'flux_pro' as const,
    name: 'Flux Pro',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Professional quality images',
  },
  {
    id: 'flux_pro_v1_1_ultra' as const,
    name: 'Flux Pro v1.1 Ultra',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Highest quality Flux model',
  },
  {
    id: 'flux_krea_lora' as const,
    name: 'Flux Krea LoRA',
    provider: 'Black Forest Labs',
    tier: 'premium',
    description: 'Flux with creative LoRA',
  },
  {
    id: 'sdxl_lightning' as const,
    name: 'SDXL Lightning',
    provider: 'Stability AI',
    tier: 'fast',
    description: 'Fast SDXL variant',
  },
  {
    id: 'sdxl' as const,
    name: 'SDXL',
    provider: 'Stability AI',
    tier: 'balanced',
    description: 'Stable Diffusion XL',
  },
  {
    id: 'imagen4_preview_ultra' as const,
    name: 'Imagen 4 Ultra',
    provider: 'Google',
    tier: 'premium',
    description: 'Google latest image model',
  },
  {
    id: 'recraft_v3' as const,
    name: 'Recraft v3',
    provider: 'Recraft',
    tier: 'premium',
    description: 'Design-focused generation',
  },
  {
    id: 'hidream_i1_full' as const,
    name: 'HiDream I1 Full',
    provider: 'HiDream',
    tier: 'premium',
    description: 'High detail rendering',
  },
  {
    id: 'letzai' as const,
    name: 'LetzAI',
    provider: 'LetzAI',
    tier: 'balanced',
    description: 'Alternative provider',
  },
] as const;

export type ImageGenerationModel = (typeof IMAGE_GENERATION_MODELS)[number];
export type ImageGenerationModelId = ImageGenerationModel['id'];

/**
 * Get image model by ID
 */
export function getImageModelById(
  id: string
): ImageGenerationModel | undefined {
  return IMAGE_GENERATION_MODELS.find((model) => model.id === id);
}

/**
 * Get display name for an image model
 */
export function getImageModelDisplayName(modelId: string): string {
  const model = getImageModelById(modelId);
  return model?.name ?? modelId;
}

/**
 * Get all image model IDs
 */
export function getAllImageModelIds(): ImageGenerationModelId[] {
  return IMAGE_GENERATION_MODELS.map((model) => model.id);
}

export const IMAGE_MODEL_IDS = getAllImageModelIds();

/**
 * Default image model to use when none is specified
 */
export const DEFAULT_IMAGE_GENERATION_MODEL: ImageGenerationModelId =
  'nano_banana';
