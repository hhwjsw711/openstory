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

const BASE_DELAY = 5;

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

      // Fetch prompt from Langfuse
      const { prompt, messages } = await getChatPrompt(
        config.promptName,
        config.promptVariables
      );

      const promptReference: PromptReference = {
        name: prompt.name,
        version: prompt.version,
        isFallback: prompt.isFallback,
      };

      return {
        startTime: Date.now(),
        messages,
        promptReference,
      };
    }
  );

  // Step 2: Durable LLM Call
  let jsonResponse: z.infer<TSchema> | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { body, status, header } = await context.api.openai.call(
      callStepName,
      {
        baseURL: 'https://openrouter.ai/api',
        token: getEnv().OPENROUTER_KEY,
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
        headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              'Upstash-Forward-X-Vercel-Protection-Bypass':
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              'x-vercel-protection-bypass':
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            }
          : undefined,
      }
    );
    await context.run('log-generation', async () => {
      // Log to Langfuse with precise timing
      logGeneration({
        name: logName,
        model: config.modelId,
        input: messages,
        output: body.choices[0]?.message?.content ?? '',
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
          }
        | {
            isValid: false;
            sleepTime: number;
          }
      > => {
        if (status < 300) {
          try {
            const validated = config.responseSchema.parse(
              JSON.parse(body.choices[0]?.message?.content ?? '')
            );
            // It's valid, now check if we need to retry
            if (config.retryResponse && config.retryResponse(validated)) {
              return {
                isValid: false,
                sleepTime: BASE_DELAY,
              };
            }
            return {
              jsonResponse: validated,
              isValid: true,
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
    break;
  }

  if (!jsonResponse) {
    // If we get here, we tried multiple times to get a valid response, but failed
    throw new WorkflowValidationError(
      `${logName} Tried multiple times to get a valid response, but failed`
    );
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
