/**
 * OpenRouter API client for AI services
 * Uses @tanstack/ai-openrouter adapters for unified AI integration
 */

import { getEnv } from '#env';
import type { PromptReference } from '@/lib/observability/langfuse';
import { startObservation } from '@langfuse/tracing';
import { chat } from '@tanstack/ai';
import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';
import { z } from 'zod';

type StreamChunk = {
  delta: string;
  accumulated: string;
  done: boolean;
};

export type ProgressCallback = (progress: {
  type: 'chunk' | 'complete';
  text: string;
  parsed?: unknown;
}) => void;

type OpenRouterMessageContent =
  | string
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: OpenRouterMessageContent;
};

type OpenRouterProviderPreference = {
  order?: string[];
  only?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
};

export type OpenRouterRequestParams = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  provider?: OpenRouterProviderPreference;
  prompt?: PromptReference;
  observationName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  responseSchema?: z.ZodTypeAny;
  apiKey?: string;
};

/**
 * Models that support structured outputs via OpenRouter.
 * https://openrouter.ai/docs/guides/features/structured-outputs
 */
const STRUCTURED_OUTPUT_MODELS = new Set([
  'bytedance-seed/seed-1.6-flash',
  'minimax/minimax-m2',
  'mistralai/mistral-small-3.2-24b-instruct',
  'x-ai/grok-4.1-fast',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'google/gemini-3-flash-preview',
  'deepseek/deepseek-v3.2',
  'google/gemini-3-pro-preview',
  'openai/gpt-5.2',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
]);

export function modelSupportsStructuredOutputs(model: string): boolean {
  return STRUCTURED_OUTPUT_MODELS.has(model);
}

function buildResponseFormat(schema: z.ZodTypeAny, name: string) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name,
      strict: true,
      schema: z.toJSONSchema(schema),
    },
  };
}

const DEFAULT_PROVIDER: OpenRouterProviderPreference = {
  order: ['Cerebras'],
};

export const RECOMMENDED_MODELS = {
  creative: 'anthropic/claude-sonnet-4.6',
  structured: 'anthropic/claude-sonnet-4.6',
  fast: 'google/gemini-3-flash-preview',
  premium: 'anthropic/claude-sonnet-4.6',
} as const;

function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }
  return content.type === 'text' ? content.text : '';
}

function convertMessages(messages: OpenRouterMessage[]): {
  systemPrompts: string[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemPrompts: string[] = [];
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
    [];

  for (const msg of messages) {
    const text = extractTextContent(msg.content);
    if (msg.role === 'system') {
      systemPrompts.push(text);
    } else {
      chatMessages.push({ role: msg.role, content: text });
    }
  }

  return { systemPrompts, messages: chatMessages };
}

/** Model ID literal type expected by the TanStack AI adapter */
type AdapterModel = Parameters<typeof createOpenRouterText>[0];

function createAdapter(model: string, apiKey?: string) {
  const env = getEnv();
  const key = apiKey ?? env.OPENROUTER_KEY;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Model is dynamic from config but always a valid OpenRouter model ID
  const modelId = model as AdapterModel;
  const config = {
    httpReferer: env.APP_URL || 'http://localhost:3000',
    xTitle: env.APP_NAME || 'AI Video Studio',
  };

  return key
    ? createOpenRouterText(modelId, key, config)
    : openRouterText(modelId, config);
}

function buildModelOptions(params: OpenRouterRequestParams) {
  return {
    provider: params.provider ?? DEFAULT_PROVIDER,
    frequency_penalty: params.frequency_penalty,
    presence_penalty: params.presence_penalty,
    ...(params.responseSchema && {
      response_format: buildResponseFormat(
        params.responseSchema,
        params.observationName ?? 'response'
      ),
    }),
  };
}

function validateStructuredOutputSupport(model: string): void {
  if (!modelSupportsStructuredOutputs(model)) {
    throw new Error(
      `Model ${model} does not support structured outputs. ` +
        `Supported models: ${[...STRUCTURED_OUTPUT_MODELS].join(', ')}`
    );
  }
}

function startGeneration(params: OpenRouterRequestParams, suffix: string) {
  const attrs = {
    model: params.model,
    input: params.messages,
    prompt: params.prompt,
    tags: params.tags,
    metadata: params.metadata,
  };
  return startObservation(
    params.observationName ?? `openrouter-${suffix}`,
    attrs,
    { asType: 'generation' }
  );
}

function endGenerationWithError(
  generation: ReturnType<typeof startObservation>,
  error: unknown
): void {
  generation
    .update({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
    })
    .end();
}

function baseChatOptions(params: OpenRouterRequestParams) {
  const { systemPrompts, messages } = convertMessages(params.messages);
  return {
    adapter: createAdapter(params.model, params.apiKey),
    messages,
    systemPrompts,
    maxTokens: params.max_tokens,
    temperature: params.temperature,
    topP: params.top_p,
    modelOptions: buildModelOptions(params),
  };
}

export async function callOpenRouter(
  params: OpenRouterRequestParams
): Promise<string> {
  if (params.responseSchema) validateStructuredOutputSupport(params.model);

  const generation = startGeneration(params, 'call');

  try {
    const result = await chat({ ...baseChatOptions(params), stream: false });
    generation.update({ output: result }).end();
    return result;
  } catch (error) {
    endGenerationWithError(generation, error);
    throw error;
  }
}

export async function* callOpenRouterStream(
  params: OpenRouterRequestParams
): AsyncGenerator<StreamChunk> {
  if (params.responseSchema) validateStructuredOutputSupport(params.model);

  const generation = startGeneration(params, 'stream');
  let accumulated = '';
  let hasError = false;

  try {
    const stream = chat({
      ...baseChatOptions(params),
      modelOptions: {
        ...buildModelOptions(params),
        stream_options: { include_usage: true },
      },
    });

    for await (const event of stream) {
      if (event.type === 'TEXT_MESSAGE_CONTENT') {
        accumulated += event.delta;
        yield { delta: event.delta, accumulated, done: false };
      }
      if (event.type === 'RUN_ERROR') {
        hasError = true;
        generation
          .update({ level: 'ERROR', statusMessage: event.error.message })
          .end();
        throw new Error(`OpenRouter stream error: ${event.error.message}`);
      }
    }

    yield { delta: '', accumulated, done: true };
  } catch (error) {
    if (!hasError) {
      hasError = true;
      endGenerationWithError(generation, error);
    }
    throw error;
  } finally {
    if (!hasError) generation.update({ output: accumulated }).end();
  }
}

export function systemMessage(content: string): OpenRouterMessage {
  return { role: 'system', content };
}

export function userMessage(content: string): OpenRouterMessage {
  return { role: 'user', content };
}

export function assistantMessage(content: string): OpenRouterMessage {
  return { role: 'assistant', content };
}
