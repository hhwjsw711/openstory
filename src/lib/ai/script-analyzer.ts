/**
 * Script analysis service for frame generation
 * Analyzes scripts to identify scene boundaries and generate frame metadata
 */

import { sanitizeScriptContent } from '@/lib/ai/prompt-validation';
import {
  storyboardPrompt,
  VELRO_UNIVERSAL_SYSTEM_PROMPT,
} from '@/lib/ai/prompts';
import {
  sceneAnalysisSchema,
  type SceneAnalysis,
} from '@/lib/ai/scene-analysis.schema';
import type { DirectorDnaConfig } from '@/lib/services/director-dna-types';
import {
  callCerebras,
  systemMessage as cerebrasSystemMessage,
  userMessage as cerebrasUserMessage,
} from './cerebras-client';
import {
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from './openrouter-client';

/**
 * Analyze script to identify frame boundaries
 * @param script - The script content to analyze
 * @param styleConfig - The director DNA configuration to use
 * @param model - The AI model to use for analysis (defaults to fast model)
 */
export async function analyzeScriptForFrames(
  script: string,
  styleConfig: DirectorDnaConfig,
  model: string = RECOMMENDED_MODELS.fast
): Promise<SceneAnalysis> {
  // Determine which provider to use based on model prefix
  const isCerebrasModel = model.startsWith('cerebras/');

  let response;

  if (isCerebrasModel) {
    // Route to Cerebras for ultra-fast inference
    if (!process.env.CEREBRAS_API_KEY) {
      throw new Error('CEREBRAS_API_KEY is not set');
    }

    response = await callCerebras({
      model,
      messages: [
        cerebrasSystemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
        cerebrasUserMessage(
          storyboardPrompt(sanitizeScriptContent(script), styleConfig)
        ),
      ],
      max_tokens: 20000,
    });
  } else {
    // Route to OpenRouter for Anthropic and other models
    if (!process.env.OPENROUTER_KEY) {
      throw new Error('OPENROUTER_KEY is not set');
    }

    response = await callOpenRouter({
      model,
      messages: [
        systemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
        userMessage(
          storyboardPrompt(sanitizeScriptContent(script), styleConfig)
        ),
      ],
    });
  }

  const content = response.choices[0].message.content;
  const parsed = extractJSON<SceneAnalysis>(content);

  if (!parsed) {
    console.error('Failed to parse this content:', content);
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Handle case where AI returns just the scenes array
  let dataToValidate = parsed;
  if (Array.isArray(parsed)) {
    dataToValidate = {
      status: 'success',
      scenes: parsed,
    };
  }

  // Validate and return the parsed result
  return sceneAnalysisSchema.parse(dataToValidate);
}
