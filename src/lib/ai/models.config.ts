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
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    tier: 'premium',
    description: 'Latest Gemini model, best quality analysis',
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
export function getAnalysisModelById(id: string): AnalysisModel | undefined {
  return SCRIPT_ANALYSIS_MODELS.find((model) => model.id === id);
}

/**
 * Get display name for a model
 */
export function getModelDisplayName(modelId: string): string {
  const model = getAnalysisModelById(modelId);
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
 * Image generation models are now in src/lib/ai/models.ts
 * Use IMAGE_MODELS, TextToImageModelId, and related helpers from there instead.
 * @deprecated Import from @/lib/ai/models instead
 */
