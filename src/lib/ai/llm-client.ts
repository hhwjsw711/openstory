/**
 * LLM client for AI services
 * Uses @tanstack/ai-openrouter adapters for unified AI integration
 */

import type { TextModel } from '@/lib/ai/models';
import type { ChatMessage } from '@/lib/prompts';
import { chat } from '@tanstack/ai';
import { z } from 'zod';
import { createAdapter } from './create-adapter';

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

type ProviderPreference = {
  order?: string[];
  only?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
};

export type LLMRequestParams = {
  model: TextModel;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  provider?: ProviderPreference;
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

const DEFAULT_PROVIDER: ProviderPreference = {
  order: ['Cerebras'],
};

export const RECOMMENDED_MODELS = {
  creative: 'anthropic/claude-sonnet-4.6',
  structured: 'anthropic/claude-sonnet-4.6',
  fast: 'google/gemini-3-flash-preview',
  premium: 'anthropic/claude-sonnet-4.6',
} as const;

function convertMessages(messages: ChatMessage[]): {
  systemPrompts: string[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemPrompts: string[] = [];
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
    [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompts.push(msg.content);
    } else {
      chatMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return { systemPrompts, messages: chatMessages };
}

function buildModelOptions(params: LLMRequestParams) {
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

function buildChatMetadata(params: LLMRequestParams) {
  return {
    observationName: params.observationName,
    prompt: params.prompt,
    tags: params.tags,
    metadata: params.metadata,
  };
}

function baseChatOptions(params: LLMRequestParams) {
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

export async function callLLM(params: LLMRequestParams): Promise<string> {
  if (params.responseSchema) validateStructuredOutputSupport(params.model);

  return chat({
    ...baseChatOptions(params),
    stream: false,
    metadata: buildChatMetadata(params),
  });
}

export async function* callLLMStream(
  params: LLMRequestParams
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
      throw new Error(`LLM stream error: ${event.error.message}`);
    }
  }

  yield { delta: '', accumulated, done: true };
}
