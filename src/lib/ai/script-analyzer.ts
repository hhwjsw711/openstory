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
  callOpenRouter,
  extractJSON,
  RECOMMENDED_MODELS,
  systemMessage,
  userMessage,
} from './openrouter-client';

/**
 * Analyze script to identify frame boundaries
 */
export async function analyzeScriptForFrames(
  script: string,
  styleConfig: DirectorDnaConfig
): Promise<SceneAnalysis> {
  if (!process.env.OPENROUTER_KEY) {
    throw new Error('OPENROUTER_KEY is not set');
  }

  // Use OpenRouter for AI-powered analysis
  const response = await callOpenRouter({
    model: RECOMMENDED_MODELS.fast,
    messages: [
      systemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
      userMessage(storyboardPrompt(sanitizeScriptContent(script), styleConfig)),
    ],
  });

  const content = response.choices[0].message.content;
  const parsed = extractJSON<SceneAnalysis>(content);

  if (!parsed) {
    console.error('Failed to parse this content:', content);
    throw new Error('Failed to parse AI response - invalid or missing JSON');
  }

  // Validate and return the parsed result
  return sceneAnalysisSchema.parse(parsed);
}
