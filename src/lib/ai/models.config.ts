/**
 * Registry of AI models available for script analysis.
 * Easy to extend with additional providers (OpenAI, xAI, Qwen, Meta, etc.)
 */

export const SCRIPT_ANALYSIS_MODELS = [
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

/**
 * Default model to use when none is specified
 */
export const DEFAULT_ANALYSIS_MODEL: AnalysisModelId =
  'anthropic/claude-haiku-4.5';
