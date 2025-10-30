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
import { getSystemPromptVersion } from './prompt-versioning';

/**
 * Audit data collected during script analysis
 */
export interface ScriptAnalysisAuditData {
  userScript: string;
  systemPromptVersion: string;
  userPrompt: string;
  styleConfig: Record<string, unknown>;
  model: string;
  rawOutput: string | null;
  parsedOutput: SceneAnalysis | null;
  apiError: string | null;
  parseError: string | null;
  tokenUsage: Record<string, unknown> | null;
  durationMs: number;
  status: 'success' | 'api_error' | 'parse_error';
}

/**
 * Result of script analysis including both the analysis and audit data
 */
export interface ScriptAnalysisResult {
  analysis: SceneAnalysis;
  auditData: ScriptAnalysisAuditData;
}

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
): Promise<ScriptAnalysisResult> {
  const startTime = Date.now();

  // Initialize audit data
  const auditData: ScriptAnalysisAuditData = {
    userScript: script,
    systemPromptVersion: await getSystemPromptVersion(
      VELRO_UNIVERSAL_SYSTEM_PROMPT
    ),
    userPrompt: storyboardPrompt(sanitizeScriptContent(script), styleConfig),
    styleConfig: styleConfig as Record<string, unknown>,
    model,
    rawOutput: null,
    parsedOutput: null,
    apiError: null,
    parseError: null,
    tokenUsage: null,
    durationMs: 0,
    status: 'success',
  };

  // Determine which provider to use based on model prefix
  const isCerebrasModel = model.startsWith('cerebras/');

  let content: string | null = null;

  try {
    if (isCerebrasModel) {
      // Route to Cerebras for ultra-fast inference
      if (!process.env.CEREBRAS_API_KEY) {
        throw new Error('CEREBRAS_API_KEY is not set');
      }

      const response = await callCerebras({
        model,
        messages: [
          cerebrasSystemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
          cerebrasUserMessage(auditData.userPrompt),
        ],
        max_tokens: 20000,
      });

      // Extract token usage if available (store raw)
      if (response.usage) {
        auditData.tokenUsage = response.usage as Record<string, unknown>;
      }

      if (!Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error('No choices returned from Cerebras');
      }
      const firstChoice = response.choices[0];
      if (!firstChoice) {
        throw new Error('No choices returned from Cerebras');
      }
      content = firstChoice.message.content;
    } else {
      // Route to OpenRouter for Anthropic and other models
      if (!process.env.OPENROUTER_KEY) {
        throw new Error('OPENROUTER_KEY is not set');
      }

      const response = await callOpenRouter({
        model,
        messages: [
          systemMessage(VELRO_UNIVERSAL_SYSTEM_PROMPT),
          userMessage(auditData.userPrompt),
        ],
      });

      // Extract token usage if available (store raw)
      if (response.usage) {
        auditData.tokenUsage = response.usage as Record<string, unknown>;
      }

      content = response.choices[0]?.message?.content;
    }

    if (!content) {
      throw new Error('AI response contained no content');
    }

    auditData.rawOutput = content;

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

    // Validate and return the parsed result with detailed error logging
    try {
      const validatedAnalysis = sceneAnalysisSchema.parse(dataToValidate);
      auditData.parsedOutput = validatedAnalysis;
      auditData.durationMs = Date.now() - startTime;
      auditData.status = 'success';

      return {
        analysis: validatedAnalysis,
        auditData,
      };
    } catch (error) {
      // Enhanced error logging for debugging workflows
      console.error('=== Script Analysis Validation Error ===');
      console.error('Model used:', model);
      console.error('\nValidation errors:');

      if (error instanceof Error && 'issues' in error) {
        // ZodError - format issues for readability
        const zodError = error as {
          issues: Array<{ path: string[]; message: string; code: string }>;
        };
        zodError.issues.forEach((issue) => {
          console.error(
            `  Path: ${issue.path.join('.')} | ${issue.message} (${issue.code})`
          );
        });
      }

      console.error('\nRaw AI response (first 2000 chars):');
      console.error(content.substring(0, 2000));

      console.error('\nParsed data structure:');
      console.error(JSON.stringify(dataToValidate, null, 2).substring(0, 2000));

      console.error('=== End Validation Error ===\n');

      // Capture parse error in audit data
      auditData.parseError =
        error instanceof Error ? error.message : 'Unknown parse error';
      auditData.durationMs = Date.now() - startTime;
      auditData.status = 'parse_error';

      throw new Error(
        `Script analysis validation failed. Model: ${model}. ${error instanceof Error ? error.message : 'Unknown error'}. Check logs for detailed output.`
      );
    }
  } catch (error) {
    // Capture API error in audit data
    auditData.apiError =
      error instanceof Error ? error.message : 'Unknown API error';
    auditData.durationMs = Date.now() - startTime;
    auditData.status = 'api_error';

    throw error;
  }
}
