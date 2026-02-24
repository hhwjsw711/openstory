/**
 * OpenRouter API client for AI services
 * Uses @tanstack/ai-openrouter adapters for unified AI integration
 */

import { getEnv } from '#env';
import type { TextModel } from '@/lib/ai/models';
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
  model: TextModel;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  provider?: OpenRouterProviderPreference;
  /** Observation name for Langfuse (forwarded via AI event bridge) */
  observationName?: string;
  /** Prompt reference for Langfuse trace linking */
  prompt?: { name: string; version: number; isFallback: boolean };
  /** Tags for Langfuse filtering */
  tags?: string[];
  /** Additional metadata for Langfuse */
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

function buildChatMetadata(params: OpenRouterRequestParams) {
  return {
    observationName: params.observationName,
    prompt: params.prompt,
    tags: params.tags,
    metadata: params.metadata,
  };
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

  return chat({
    ...baseChatOptions(params),
    stream: false,
    metadata: buildChatMetadata(params),
  });
}

export async function* callOpenRouterStream(
  params: OpenRouterRequestParams
): AsyncGenerator<StreamChunk> {
  if (params.responseSchema) validateStructuredOutputSupport(params.model);

  let accumulated = '';

  const stream = chat({
    ...baseChatOptions(params),
    metadata: buildChatMetadata(params),
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
      throw new Error(`OpenRouter stream error: ${event.error.message}`);
    }
  }

  yield { delta: '', accumulated, done: true };
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
