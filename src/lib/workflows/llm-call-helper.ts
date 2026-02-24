/**
 * Durable LLM Call Helper
 * Encapsulates the 3-step pattern: prepare -> call -> log
 * Uses @tanstack/ai-openrouter adapters instead of context.api.openai.call
 */

import { getEnv } from '#env';
import type { TextModel } from '@/lib/ai/models';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import type { PromptReference } from '@/lib/observability/langfuse';
import { getChatPrompt } from '@/lib/observability/langfuse-prompts';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { chat } from '@tanstack/ai';
import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';
import type { WorkflowContext } from '@upstash/workflow';
import { z } from 'zod';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_SECONDS = 5;

export type DurableLLMCallConfig<TSchema extends z.ZodType> = {
  name: string;
  phase: { number: number; name: string };
  promptName: string;
  promptVariables?: Record<string, string>;
  modelId: TextModel;
  responseSchema: TSchema;
  additionalMetadata?: Record<string, unknown>;
  retryResponse?: (response: z.infer<TSchema>) => boolean;
};

export type DurableLLMCallContext = {
  sequenceId?: string;
  userId?: string;
  teamId?: string;
  /** Override OpenRouter API key (e.g., user-provided key). Falls back to platform env key. */
  openRouterApiKey?: string;
};

function createAdapter(model: TextModel, apiKey?: string) {
  const env = getEnv();
  const key = apiKey ?? env.OPENROUTER_KEY;
  // Adapter type list lags behind OpenRouter's catalog — cast at the boundary
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Model is dynamic from config but always a valid OpenRouter model ID
  const adapterModel = model as Parameters<typeof createOpenRouterText>[0];
  const config = {
    httpReferer: env.APP_URL || 'http://localhost:3000',
    xTitle: env.APP_NAME || 'AI Video Studio',
  };

  return key
    ? createOpenRouterText(adapterModel, key, config)
    : openRouterText(adapterModel, config);
}

/**
 * Execute a durable LLM call with the standard 3-step pattern:
 * 1. Prepare: Fetch prompt from Langfuse, emit phase start
 * 2. Call: LLM call via context.run() + @tanstack/ai-openrouter
 * 3. Log & Process: Log to Langfuse, parse response, emit phase complete
 *
 * Uses context.run() instead of context.api.openai.call() to avoid
 * passing API keys in headers that get stored in Upstash logs.
 */
export async function durableLLMCall<TInput, TSchema extends z.ZodType>(
  context: WorkflowContext<TInput>,
  config: DurableLLMCallConfig<TSchema>,
  callContext: DurableLLMCallContext
): Promise<z.infer<TSchema>> {
  const { name, phase, modelId } = config;
  const logName = `phase-${phase.number}-${name}`;
  const logTags = [name, `phase-${phase.number}`, 'analysis'];
  const logMetadata = {
    phase: phase.number,
    phaseName: phase.name,
    ...config.additionalMetadata,
  };

  // Step 1: Prepare -- fetch prompt and emit phase start
  const { messages, promptReference } = await context.run(
    `prepare-${name}`,
    async () => {
      if (callContext.sequenceId) {
        await getGenerationChannel(callContext.sequenceId).emit(
          'generation.phase:start',
          { phase: phase.number, phaseName: phase.name }
        );
      }

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

      return { messages, promptReference };
    }
  );

  // Step 2: Durable LLM call with retry loop
  let jsonResponse: z.infer<TSchema> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await context.run(name, async () => {
      try {
        const adapter = createAdapter(modelId, callContext.openRouterApiKey);

        const systemPrompts: string[] = [];
        const chatMessages: Array<{
          role: 'user' | 'assistant';
          content: string;
        }> = [];

        for (const msg of messages) {
          if (msg.role === 'system') {
            systemPrompts.push(msg.content);
          } else {
            chatMessages.push({ role: msg.role, content: msg.content });
          }
        }

        const text = await chat({
          adapter,
          messages: chatMessages,
          systemPrompts,
          stream: false,
          metadata: {
            observationName: logName,
            prompt: promptReference,
            tags: logTags,
            metadata: logMetadata,
            sessionId: callContext.sequenceId,
            userId: callContext.userId,
          },
          // response_format uses json_schema which OpenRouter supports but adapter types declare as json_object only
          modelOptions: {
            response_format: {
              type: 'json_schema' as const,
              json_schema: {
                name,
                strict: true,
                schema: z.toJSONSchema(config.responseSchema),
              },
            },
          } as Record<string, unknown>,
        });

        return { content: text, error: null };
      } catch (error) {
        return {
          content: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const validated = await context.run(
      'validate-response',
      async (): Promise<z.infer<TSchema> | null> => {
        if (result.error || !result.content) return null;

        try {
          const parsed = config.responseSchema.parse(
            JSON.parse(result.content)
          );
          if (config.retryResponse?.(parsed)) return null;
          return parsed;
        } catch {
          return null;
        }
      }
    );

    if (validated === null) {
      await context.sleep('pause-to-avoid-spam', RETRY_DELAY_SECONDS);
      continue;
    }
    jsonResponse = validated;
    break;
  }

  if (!jsonResponse) {
    throw new WorkflowValidationError(
      `${logName} Tried multiple times to get a valid response, but failed`
    );
  }

  // Deduct LLM credits (cost tracked via Langfuse; adapter doesn't expose per-call usage)
  if (callContext.teamId) {
    await context.run(`deduct-llm-credits-${name}`, async () => {
      await deductWorkflowCredits({
        teamId: callContext.teamId,
        costUsd: 0,
        usedOwnKey: !!callContext.openRouterApiKey,
        userId: callContext.userId,
        description: `LLM analysis (${modelId})`,
        metadata: {
          model: modelId,
          phase: phase.number,
          phaseName: phase.name,
          stepName: name,
          sequenceId: callContext.sequenceId,
        },
      });
    });
  }

  // Step 3: Emit phase complete
  await context.run(`log-${name}`, async () => {
    if (callContext.sequenceId) {
      await getGenerationChannel(callContext.sequenceId).emit(
        'generation.phase:complete',
        { phase: phase.number }
      );
    }
  });

  return jsonResponse;
}
