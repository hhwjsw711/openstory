/**
 * Registry of AI models available for script analysis.
 * Easy to extend with additional providers (OpenAI, xAI, Qwen, Meta, etc.)
 */

export const SCRIPT_ANALYSIS_MODELS = [
  // === FAST TIER ===
  {
    id: 'bytedance-seed/seed-1.6-flash',
    name: 'Seed 1.6 Flash',
    provider: 'ByteDance',
    tier: 'fast',
    description: 'Ultra-fast multimodal with 256K context',
  },
  {
    id: 'minimax/minimax-m2',
    name: 'MiniMax M2',
    provider: 'MiniMax',
    tier: 'fast',
    description: 'Fast with 131K context',
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    name: 'Mistral Small 3.2',
    provider: 'Mistral',
    tier: 'fast',
    description: 'Latest small model with 131K context',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'xAI',
    tier: 'fast',
    description: 'Latest fast xAI model',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    tier: 'fast',
    description: 'Compact GPT-5 with 128K context',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    tier: 'fast',
    description: 'Fast multimodal model',
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM 4.7',
    provider: 'Z.ai',
    tier: 'fast',
    description: 'Strong reasoning with 200K context',
  },

  // === PREMIUM TIER ===
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    tier: 'premium',
    description: 'Latest DeepSeek model',
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    tier: 'premium',
    description: 'High-quality multimodal reasoning',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Latest GPT-5 series',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    description: 'State-of-the-art coding',
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    description: 'Frontier reasoning',
  },
] as const;

type AnalysisModel = (typeof SCRIPT_ANALYSIS_MODELS)[number];
export type AnalysisModelId = AnalysisModel['id'];

/**
 * Get model by ID
 */
export function getAnalysisModelById(id: string): AnalysisModel | undefined {
  return SCRIPT_ANALYSIS_MODELS.find((model) => model.id === id);
}

/**
 * Runtime validation: Check if a string is a valid AnalysisModelId
 * @param value - String value to validate
 * @returns true if value is a valid model ID, false otherwise
 */
export function isValidAnalysisModelId(
  value: unknown
): value is AnalysisModelId {
  return (
    typeof value === 'string' &&
    SCRIPT_ANALYSIS_MODELS.some((model) => model.id === value)
  );
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
  'google/gemini-3-flash-preview';

/**
 * Image generation models are now in src/lib/ai/models.ts
 * Use IMAGE_MODELS, TextToImageModelId, and related helpers from there instead.
 * @deprecated Import from @/lib/ai/models instead
 */
