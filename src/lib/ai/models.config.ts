/**
 * Registry of AI models available for script analysis.
 * Easy to extend with additional providers (OpenAI, xAI, Qwen, Meta, etc.)
 */

export const SCRIPT_ANALYSIS_MODELS = [
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM 4.6',
    provider: 'Z.ai',
    tier: 'ultra-fast',
    description: 'Strong reasoning and tool use, 200K context (~1,000 tok/s)',
  },
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
  // Anthropic models
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
    description: 'State-of-the-art coding performance',
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    tier: 'premium',
    description: 'Frontier reasoning for complex tasks',
  },
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'xAI',
    tier: 'premium',
    description: 'Fast analysis, higher quality',
  },
  // Google models
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    tier: 'premium',
    description: 'Latest multimodal reasoning model',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    tier: 'fast',
    description: 'High-speed Gemini 3 model',
  },
  // OpenAI models
  {
    id: 'openai/gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Latest flagship model',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Latest GPT-5 series model',
  },
  {
    id: 'openai/gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Optimized for code generation',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    tier: 'fast',
    description: 'Compact, efficient model',
  },
  {
    id: 'openai/o3-pro',
    name: 'o3 Pro',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Advanced reasoning model',
  },
  {
    id: 'openai/o3',
    name: 'o3',
    provider: 'OpenAI',
    tier: 'premium',
    description: 'Well-rounded reasoning model',
  },
  {
    id: 'openai/o4-mini-high',
    name: 'o4 Mini High',
    provider: 'OpenAI',
    tier: 'fast',
    description: 'Cost-efficient reasoning model',
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

type AnalysisModel = (typeof SCRIPT_ANALYSIS_MODELS)[number];
export type AnalysisModelId = AnalysisModel['id'];

/**
 * Get model by ID
 */
export function getAnalysisModelById(id: string): AnalysisModel | undefined {
  return SCRIPT_ANALYSIS_MODELS.find((model) => model.id === id);
}

/**
 * Get display name for a model
 */
function getModelDisplayName(modelId: string): string {
  const model = getAnalysisModelById(modelId);
  return model?.name ?? modelId;
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
  'anthropic/claude-haiku-4.5';

/**
 * Image generation models are now in src/lib/ai/models.ts
 * Use IMAGE_MODELS, TextToImageModelId, and related helpers from there instead.
 * @deprecated Import from @/lib/ai/models instead
 */
