/**
 * Durable LLM Call Helper
 * Encapsulates the 3-step pattern: prepare -> call -> log
 * Uses @tanstack/ai-openrouter adapters instead of context.api.openai.call
 */

import { createAdapter } from '@/lib/ai/create-adapter';
import { getContextWindow } from '@/lib/ai/models.config';
import type { TextModel } from '@/lib/ai/models';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { apiKeyService } from '@/lib/byok/api-key.service';
import type { PromptReference } from '@/lib/observability/langfuse';
import { getChatPrompt } from '@/lib/prompts';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { chat } from '@tanstack/ai';
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
  maxTokens?: number;
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

  // Step 2: Durable LLM call (context.run retries on failure automatically)
  let jsonResponse: z.infer<TSchema> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const data = await context.run(
      attempt === 0 ? name : `${name}-retry-${attempt}`,
      async () => {
        const openRouterApiKeyInfo = await apiKeyService.resolveKey(
          'openrouter',
          callContext.teamId
        );
        const adapter = createAdapter(modelId, openRouterApiKeyInfo.key);

        console.log(`[LLM:${logName}] Starting call`, {
          model: modelId,
          attempt,
          keySource: openRouterApiKeyInfo.source,
          messageCount: messages.length,
        });

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

        try {
          // chat() with outputSchema returns a parsed object, not a string
          const result = await chat({
            adapter,
            messages: chatMessages,
            systemPrompts,
            stream: false,
            maxTokens: Math.min(
              config.maxTokens ?? 16_000,
              Math.floor(getContextWindow(config.modelId) * 0.75)
            ),
            metadata: {
              observationName: logName,
              prompt: promptReference,
              tags: logTags,
              metadata: logMetadata,
              sessionId: callContext.sequenceId,
              userId: callContext.userId,
            },
            outputSchema: config.responseSchema,
          });

          console.log(`[LLM:${logName}] Call succeeded`);
          return result;
        } catch (error) {
          const errorDetails = {
            model: modelId,
            attempt,
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            cause: error instanceof Error ? error.cause : undefined,
          };
          console.error(`[LLM:${logName}] Call failed`, errorDetails);
          throw error;
        }
      }
    );

    // retryResponse is a business logic check (e.g., empty results)
    if (config.retryResponse?.(data)) {
      await context.sleep(`retry-pause-${attempt}`, RETRY_DELAY_SECONDS);
      continue;
    }

    jsonResponse = data;
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
