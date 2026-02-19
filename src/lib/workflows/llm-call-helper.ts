/**
 * Durable LLM Call Helper
 * Encapsulates the 3-step pattern: prepare → call → log
 * Uses @tanstack/ai-openrouter adapters instead of context.api.openai.call
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
import { chat } from '@tanstack/ai';
import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';

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
  teamId?: string;
  /** Override OpenRouter API key (e.g., user-provided key). Falls back to platform env key. */
  openRouterApiKey?: string;
};

/**
 * Build OpenRouter response_format from Zod schema
 */
function buildResponseFormat(schema: z.ZodTypeAny, name: string) {
  const jsonSchema = z.toJSONSchema(schema);
  return {
    type: 'json_schema' as const,
    json_schema: {
      name,
      strict: true,
      schema: jsonSchema,
    },
  };
}

/**
 * Create a TanStack AI OpenRouter adapter
 */
// Model ID type expected by the adapter (union of known model strings)
type AdapterModel = Parameters<typeof createOpenRouterText>[0];

function createAdapter(model: string, apiKey?: string) {
  const key = apiKey ?? getEnv().OPENROUTER_KEY;
  const env = getEnv();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Model is dynamic from config but always a valid OpenRouter model ID
  const m = model as AdapterModel;

  if (key) {
    return createOpenRouterText(m, key, {
      httpReferer: env.APP_URL || 'http://localhost:3000',
      xTitle: env.APP_NAME || 'AI Video Studio',
    });
  }

  return openRouterText(m, {
    httpReferer: env.APP_URL || 'http://localhost:3000',
    xTitle: env.APP_NAME || 'AI Video Studio',
  });
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

  // Step 2: Durable LLM Call via context.run() + TanStack AI adapter
  let jsonResponse: z.infer<TSchema> | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await context.run(callStepName, async () => {
      try {
        const adapter = createAdapter(
          config.modelId,
          callContext.openRouterApiKey
        );

        // Separate system prompts from chat messages
        const systemPrompts: string[] = [];
        const chatMessages: Array<{
          role: 'user' | 'assistant';
          content: string;
        }> = [];

        for (const msg of messages) {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content);
          if (msg.role === 'system') {
            systemPrompts.push(content);
          } else {
            chatMessages.push({
              role: msg.role,
              content,
            });
          }
        }

        const text = await chat({
          adapter,
          messages: chatMessages,
          systemPrompts,
          stream: false,
          // response_format uses json_schema which OpenRouter supports but adapter types declare as json_object only
          modelOptions: {
            response_format: buildResponseFormat(
              config.responseSchema,
              schemaName
            ),
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

    // Log generation to Langfuse
    await context.run('log-generation', async () => {
      const outputContent = result.content ?? '';
      logGeneration({
        name: logName,
        model: config.modelId,
        input: messages,
        output: outputContent,
        prompt: promptReference,
        tags: logTags,
        metadata: logMetadata,
        startTime: new Date(startTime),
        sequenceId: callContext.sequenceId,
        userId: callContext.userId,
      });
    });

    // Validate response
    const validation = await context.run(
      'validate-response',
      async (): Promise<
        | { isValid: true; jsonResponse: z.infer<TSchema>; sleepTime?: never }
        | { isValid: false; sleepTime: number; jsonResponse?: never }
      > => {
        if (result.error || !result.content) {
          return { isValid: false, sleepTime: BASE_DELAY };
        }

        try {
          const validated = config.responseSchema.parse(
            JSON.parse(result.content)
          );

          // Check custom retry condition
          if (config.retryResponse && config.retryResponse(validated)) {
            return { isValid: false, sleepTime: BASE_DELAY };
          }

          return { isValid: true, jsonResponse: validated };
        } catch {
          return { isValid: false, sleepTime: BASE_DELAY };
        }
      }
    );

    if (!validation.isValid) {
      await context.sleep('pause-to-avoid-spam', validation.sleepTime);
      continue;
    }
    jsonResponse = validation.jsonResponse;
    break;
  }

  if (!jsonResponse) {
    throw new WorkflowValidationError(
      `${logName} Tried multiple times to get a valid response, but failed`
    );
  }

  // Deduct LLM credits (use estimated cost since TanStack AI doesn't expose usage)
  const teamIdForDeduction = callContext.teamId;
  if (teamIdForDeduction) {
    await context.run(`deduct-llm-credits-${config.name}`, async () => {
      await deductWorkflowCredits({
        teamId: teamIdForDeduction,
        costUsd: 0, // Cost tracked via Langfuse; adapter doesn't expose per-call usage
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
