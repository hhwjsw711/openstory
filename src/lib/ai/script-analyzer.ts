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
import { createAuditRecord } from '@/lib/services/script-analysis-audit.service';
import { ZodError } from 'zod';
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
 * Internal audit data collected during script analysis
 */
type ScriptAnalysisAuditData = {
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
};

/**
 * Analyze script to identify frame boundaries
 * @param script - The script content to analyze
 * @param styleConfig - The director DNA configuration to use
 * @param model - The AI model to use for analysis (defaults to fast model)
 * @param auditContext - Optional context for creating audit trail (sequenceId, teamId, userId)
 */
export async function analyzeScriptForFrames(
  script: string,
  styleConfig: DirectorDnaConfig,
  model: string = RECOMMENDED_MODELS.fast,
  auditContext?: { sequenceId: string; teamId: string; userId: string }
): Promise<{ analysis: SceneAnalysis; durationMs: number }> {
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
    status: 'api_error', // Set the status to api error just in case it fails at any point
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
      // Don't log entire content - just show preview
      const preview =
        content.length > 200
          ? `${content.slice(0, 200)}...[truncated ${content.length} chars]`
          : content;
      console.error('Failed to parse AI response:', preview);
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

    // Set the status to parse error just in case it fails to parse
    auditData.status = 'parse_error';

    const validatedAnalysis = sceneAnalysisSchema.parse(dataToValidate);
    // Set the status to success
    auditData.status = 'success';
    auditData.parsedOutput = validatedAnalysis;

    // return the analysis and the duration
    return {
      analysis: validatedAnalysis,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Distinguish between parse errors and API errors
    if (error instanceof ZodError) {
      // Format validation errors for logging
      console.error('\n❌ Script analysis validation failed:');
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        console.error(`  - ${path}: ${issue.message}`);
      });

      // Show preview of raw output
      if (auditData.rawOutput) {
        const preview =
          auditData.rawOutput.length > 200
            ? `${auditData.rawOutput.slice(0, 200)}...[truncated ${auditData.rawOutput.length} chars]`
            : auditData.rawOutput;
        console.error('\nRaw output preview:', preview);
      }

      // Store the parse error details
      auditData.parseError = JSON.stringify(error.issues);

      // Include first error in user-facing message for debugging
      const firstError = error.issues[0];
      const errorDetail = firstError
        ? ` Missing/invalid field: ${firstError.path.join('.')}`
        : '';

      throw new Error(
        `Failed to parse AI response.${errorDetail} Check logs for details.`
      );
    } else {
      // API or other errors
      auditData.apiError =
        error instanceof Error ? error.message : 'Unknown API error';

      throw new Error(
        `Failed to turn the script you entered into scenes. Maybe try enhancing the script first?`
      );
    }
  } finally {
    if (auditContext) {
      await createAuditRecord({
        sequenceId: auditContext.sequenceId,
        teamId: auditContext.teamId,
        userId: auditContext.userId,
        userScript: auditData.userScript,
        systemPromptVersion: auditData.systemPromptVersion,
        userPrompt: auditData.userPrompt,
        styleConfig: auditData.styleConfig,
        model: auditData.model,
        rawOutput: auditData.rawOutput,
        parsedOutput: auditData.parsedOutput,
        apiError: auditData.apiError,
        parseError: auditData.parseError,
        tokenUsage: auditData.tokenUsage,
        durationMs: Date.now() - startTime,
        status: auditData.status,
      });
    }
  }
}
