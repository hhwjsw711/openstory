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
    contextWindow: 262_144,
    description: 'Ultra-fast multimodal with 256K context',
  },
  {
    id: 'minimax/minimax-m2',
    name: 'MiniMax M2',
    provider: 'MiniMax',
    tier: 'fast',
    contextWindow: 196_608,
    description: 'Fast with 131K context',
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    name: 'Mistral Small 3.2',
    provider: 'Mistral',
    tier: 'fast',
    contextWindow: 128_000,
    description: 'Latest small model with 131K context',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'xAI',
    tier: 'fast',
    contextWindow: 2_000_000,
    description: 'Latest fast xAI model',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    tier: 'fast',
    contextWindow: 400_000,
    description: 'Compact GPT-5 with 128K context',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    tier: 'fast',
    contextWindow: 400_000,
    description:
      'GPT-5-Nano is the smallest and fastest variant in the GPT-5 system',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    tier: 'fast',
    contextWindow: 1_048_576,
    description: 'Fast multimodal model',
  },
  // === PREMIUM TIER ===
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    tier: 'premium',
    contextWindow: 163_840,
    description: 'Latest DeepSeek model',
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    tier: 'premium',
    contextWindow: 1_048_576,
    description: 'High-quality multimodal reasoning',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    tier: 'premium',
    contextWindow: 400_000,
    description: 'Latest GPT-5 series',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tier: 'premium',
    contextWindow: 1_000_000,
    description: 'State-of-the-art coding',
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tier: 'premium',
    contextWindow: 1_000_000,
    description: 'Frontier reasoning and coding',
  },
  {
    id: 'z-ai/glm-5',
    name: 'GLM 5',
    provider: 'Z.ai',
    tier: 'premium',
    contextWindow: 202_752,
    description: 'Open-source 744B systems engineering',
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
 * Get context window size (in tokens) for a model
 */
export function getContextWindow(modelId: string): number {
  const model = SCRIPT_ANALYSIS_MODELS.find((m) => m.id === modelId);
  return model?.contextWindow ?? 128_000;
}
/**
 * Default model to use when none is specified
 */
export const DEFAULT_ANALYSIS_MODEL: AnalysisModelId =
  'anthropic/claude-sonnet-4.6';

/**
 * Image generation models are now in src/lib/ai/models.ts
 * Use IMAGE_MODELS, TextToImageModelId, and related helpers from there instead.
 * @deprecated Import from @/lib/ai/models instead
 */
