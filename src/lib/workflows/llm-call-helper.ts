/**
 * Durable LLM Call Helper
 * Encapsulates the 3-step pattern: prepare → call → log
 */

import type { WorkflowContext } from '@upstash/workflow';
import { z } from 'zod';
import { getChatPrompt } from '@/lib/observability/langfuse-prompts';
import {
  type PromptReference,
  logGeneration,
} from '@/lib/observability/langfuse';
import { getEnv } from '#env';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { getGenerationChannel } from '@/lib/realtime';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';

const BASE_DELAY = 5;

/** Safely extract OpenRouter's extended `cost` field from usage object */
function extractUsageCost(usage: unknown): number {
  if (usage && typeof usage === 'object' && 'cost' in usage) {
    const val = (usage as { cost: unknown }).cost;
    return typeof val === 'number' ? val : 0;
  }
  return 0;
}

export type DurableLLMCallConfig<TSchema extends z.ZodType> = {
  // Base name (e.g., "scene-splitting") - used to derive step names
  name: string;

  // Phase information (automatically generates events, tags, metadata)
  phase: {
    number: number;
    name: string; // e.g., "Scene Splitting"
  };

  // Prompt config
  promptName: string;
  promptVariables?: Record<string, string>;

  // LLM config
  modelId: string;
  responseSchema: TSchema;

  // Optional: Additional metadata to merge with auto-generated metadata
  additionalMetadata?: Record<string, unknown>;

  // Optional: Additonal Validation. Retry if failing
  retryResponse?: (response: z.infer<TSchema>) => boolean;
};

export type DurableLLMCallContext = {
  sequenceId?: string;
  userId?: string;
  teamId?: string;
  /** Override OpenRouter API key (e.g., user-provided key). Falls back to platform env key. */
  openRouterApiKey?: string;
};

/**
 * Execute a durable LLM call with the standard 3-step pattern:
 * 1. Prepare: Fetch prompt from Langfuse, emit phase start
 * 2. Call: Durable LLM call via context.api.openai
 * 3. Log & Process: Log to Langfuse, parse response, emit phase complete
 *
 * All step names, tags, and metadata are automatically derived from `name` and `phase`.
 *
 * @example
 * ```typescript
 * // Simple case - just returns validated data
 * const result = await durableLLMCall(context, {
 *   name: 'character-extraction',
 *   phase: { number: 2, name: 'Character Extraction' },
 *   promptName: 'velro/phase/character-extraction',
 *   promptVariables: { script },
 *   modelId: analysisModelId,
 *   responseSchema: characterExtractionSchema,
 * }, { sequenceId, userId });
 * // result has type z.infer<typeof characterExtractionSchema>
 *
 * // Complex case - custom processing logic
 * const enriched = await durableLLMCall<
 *   AnalyzeScriptWorkflowInput,
 *   typeof mySchema,
 *   MyCustomType
 * >(context, {
 *   name: 'my-operation',
 *   phase: { number: 1, name: 'My Phase' },
 *   promptName: 'velro/phase/my-prompt',
 *   promptVariables: { input: 'value' },
 *   modelId: analysisModelId,
 *   responseSchema: mySchema,
 *   processResponse: async (_content, validated) => {
 *     // Merge, validate, emit events, etc.
 *     return { customField: validated.data };
 *   },
 *   additionalMetadata: { customKey: 'value' },
 * }, { sequenceId, userId });
 * ```
 */
export async function durableLLMCall<TInput, TSchema extends z.ZodType>(
  context: WorkflowContext<TInput>,
  config: DurableLLMCallConfig<TSchema>,
  callContext: DurableLLMCallContext
): Promise<z.infer<TSchema>> {
  // Derive all field names from config.name and config.phase
  const prepareStepName = `prepare-${config.name}`;
  const callStepName = config.name;
  const logStepName = `log-${config.name}`;
  const schemaName = config.name;
  const logName = `phase-${config.phase.number}-${config.name}`;
  const logTags = [config.name, `phase-${config.phase.number}`, 'analysis'];
  const logMetadata = {
    phase: config.phase.number,
    phaseName: config.phase.name,
    ...config.additionalMetadata,
  };

  // Step 1: Prepare
  const { startTime, messages, promptReference } = await context.run(
    prepareStepName,
    async () => {
      // Emit phase start
      if (callContext.sequenceId) {
        await getGenerationChannel(callContext.sequenceId).emit(
          'generation.phase:start',
          {
            phase: config.phase.number,
            phaseName: config.phase.name,
          }
        );
      }

      // Fetch prompt (Langfuse if enabled, otherwise local fallback)
      const { prompt, messages } = await getChatPrompt(
        config.promptName,
        config.promptVariables
      );

      const promptReference: PromptReference | undefined = prompt
        ? {
            name: prompt.name,
            version: prompt.version,
            isFallback: prompt.isFallback,
          }
        : undefined;

      return {
        startTime: Date.now(),
        messages,
        promptReference,
      };
    }
  );

  // Step 2: Durable LLM Call
  let jsonResponse: z.infer<TSchema> | null = null;
  let llmCostUsd = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { body, status, header } = await context.api.openai.call(
      callStepName,
      {
        baseURL: 'https://openrouter.ai/api',
        token: callContext.openRouterApiKey ?? getEnv().OPENROUTER_KEY,
        operation: 'chat.completions.create',
        body: {
          model: config.modelId,
          messages,
          usage: { include: true },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              strict: true,
              schema: z.toJSONSchema(config.responseSchema),
            },
          },
        },
        headers: (() => {
          const bypassSecret = getEnv().VERCEL_AUTOMATION_BYPASS_SECRET;
          return bypassSecret
            ? {
                'Upstash-Forward-X-Vercel-Protection-Bypass': bypassSecret,
                'x-vercel-protection-bypass': bypassSecret,
              }
            : undefined;
        })(),
      }
    );
    await context.run('log-generation', async () => {
      // Log to Langfuse with precise timing
      // Guard against API errors where body.choices might be undefined
      const outputContent = body.choices?.[0]?.message?.content ?? '';
      logGeneration({
        name: logName,
        model: config.modelId,
        input: messages,
        output: outputContent,
        usage: body.usage,
        prompt: promptReference,
        tags: logTags,
        metadata: logMetadata,
        startTime: new Date(startTime),
        sequenceId: callContext.sequenceId,
        userId: callContext.userId,
      });
    });

    const result = await context.run(
      'validate-response',
      async (): Promise<
        | {
            isValid: true;
            jsonResponse: z.infer<TSchema> | null;
            costUsd: number;
          }
        | {
            isValid: false;
            sleepTime: number;
          }
      > => {
        if (status < 300) {
          try {
            // Guard against API errors where body.choices might be undefined
            const content = body.choices?.[0]?.message?.content ?? '';
            if (!content) {
              return {
                isValid: false,
                sleepTime: BASE_DELAY,
              };
            }
            const validated = config.responseSchema.parse(JSON.parse(content));
            // It's valid, now check if we need to retry
            if (config.retryResponse && config.retryResponse(validated)) {
              return {
                isValid: false,
                sleepTime: BASE_DELAY,
              };
            }
            // Extract cost from OpenRouter usage response (extended field not in base OpenAI types)
            const costUsd = extractUsageCost(body.usage);
            return {
              jsonResponse: validated,
              isValid: true,
              costUsd,
            };
          } catch {
            // If the response is not valid, retry
            return {
              isValid: false,
              sleepTime: BASE_DELAY,
            };
          }
        }
        if (status === 429) {
          const sleepTime =
            Number(header['x-ratelimit-reset-tokens']?.[0]) ||
            Number(header['x-ratelimit-reset-requests']?.[0]) ||
            BASE_DELAY;

          // assuming `resetTime` is in seconds
          return {
            isValid: false,
            sleepTime,
          };
        }
        // Otherwise it's not a valid response
        return {
          isValid: false,
          sleepTime: BASE_DELAY,
        };
      }
    );
    if (!result.isValid) {
      // Any other scenario - pause for 5 seconds to avoid overloading OpenAI API
      await context.sleep('pause-to-avoid-spam', result.sleepTime);
      continue;
    }
    jsonResponse = result.jsonResponse;
    llmCostUsd = result.costUsd;
    break;
  }

  if (!jsonResponse) {
    // If we get here, we tried multiple times to get a valid response, but failed
    throw new WorkflowValidationError(
      `${logName} Tried multiple times to get a valid response, but failed`
    );
  }

  // Deduct LLM credits (skip if team used own OpenRouter key)
  const teamIdForDeduction = callContext.teamId;
  if (teamIdForDeduction) {
    await context.run(`deduct-llm-credits-${config.name}`, async () => {
      await deductWorkflowCredits({
        teamId: teamIdForDeduction,
        costUsd: llmCostUsd,
        usedOwnKey: !!callContext.openRouterApiKey,
        userId: callContext.userId,
        description: `LLM analysis (${config.modelId})`,
        metadata: {
          model: config.modelId,
          phase: config.phase.number,
          phaseName: config.phase.name,
          stepName: config.name,
          sequenceId: callContext.sequenceId,
        },
      });
    });
  }

  // Step 3: Log & Process
  await context.run(logStepName, async () => {
    // Emit phase complete
    if (callContext.sequenceId) {
      await getGenerationChannel(callContext.sequenceId).emit(
        'generation.phase:complete',
        { phase: config.phase.number }
      );
    }
  });
  return jsonResponse;
}
