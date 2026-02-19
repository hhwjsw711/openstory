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
  delta: string; // Text chunk
  accumulated: string; // Full accumulated text so far
  done: boolean; // Whether stream is complete
};

export type ProgressCallback = (progress: {
  type: 'chunk' | 'complete';
  text: string; // Current accumulated text
  parsed?: unknown; // Parsed result (only on complete)
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
  /** Langfuse prompt for trace linking */
  prompt?: PromptReference;
  /** Custom observation name for Langfuse filtering (e.g., 'phase-1-scene-splitting') */
  observationName?: string;
  /** Tags for Langfuse filtering */
  tags?: string[];
  /** Additional metadata for Langfuse */
  metadata?: Record<string, unknown>;
  /** Zod schema for structured outputs - when provided, OpenRouter enforces JSON schema */
  responseSchema?: z.ZodTypeAny;
  /** Override API key (e.g., user-provided key). Falls back to platform env key. */
  apiKey?: string;
};

/**
 * Models that support structured outputs via OpenRouter
 * https://openrouter.ai/docs/guides/features/structured-outputs
 * Curated list - only latest version of each model family
 */
const STRUCTURED_OUTPUT_MODELS = new Set([
  // Fast tier
  'bytedance-seed/seed-1.6-flash',
  'minimax/minimax-m2',
  'mistralai/mistral-small-3.2-24b-instruct',
  'x-ai/grok-4.1-fast',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'google/gemini-3-flash-preview',
  // Premium tier
  'deepseek/deepseek-v3.2',
  'google/gemini-3-pro-preview',
  'openai/gpt-5.2',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
]);

/**
 * Check if a model supports structured outputs
 */
export function modelSupportsStructuredOutputs(model: string): boolean {
  return STRUCTURED_OUTPUT_MODELS.has(model);
}

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
 * Default provider preference - prefer Cerebras for speed
 */
const DEFAULT_PROVIDER: OpenRouterProviderPreference = {
  order: ['Cerebras'],
};

/**
 * Model recommendations for different tasks
 * Note: All models here support structured outputs
 */
export const RECOMMENDED_MODELS = {
  // For creative writing and scene descriptions
  creative: 'anthropic/claude-sonnet-4.6',

  // For structured data extraction
  structured: 'anthropic/claude-sonnet-4.6',

  // For fast responses with good quality (supports structured outputs)
  fast: 'google/gemini-3-flash-preview',

  // For highest quality (more expensive)
  premium: 'anthropic/claude-sonnet-4.6',
} as const;

/**
 * Extract text content from an OpenRouterMessageContent value
 */
function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text')
      .map((c) => ('text' in c ? c.text : ''))
      .join('');
  }
  return content.type === 'text' ? content.text : '';
}

/**
 * Convert our message format to TanStack AI format
 */
function convertMessages(messages: OpenRouterMessage[]) {
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

/**
 * Create a TanStack AI OpenRouter adapter with appropriate config
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

  // Fall back to env-based adapter (reads OPENROUTER_API_KEY)
  return openRouterText(m, {
    httpReferer: env.APP_URL || 'http://localhost:3000',
    xTitle: env.APP_NAME || 'AI Video Studio',
  });
}

/**
 * Build model-specific options passed to the OpenRouter adapter
 */
function buildModelOptions(params: OpenRouterRequestParams) {
  return {
    provider: params.provider ?? DEFAULT_PROVIDER,
    ...(params.frequency_penalty !== undefined && {
      frequency_penalty: params.frequency_penalty,
    }),
    ...(params.presence_penalty !== undefined && {
      presence_penalty: params.presence_penalty,
    }),
    ...(params.responseSchema && {
      response_format: buildResponseFormat(
        params.responseSchema,
        params.observationName ?? 'response'
      ),
    }),
  };
}

/**
 * Make a non-streaming request to OpenRouter API
 * Returns the text content of the response
 */
export async function callOpenRouter(
  params: OpenRouterRequestParams
): Promise<string> {
  // Validate model supports structured outputs if schema is provided
  if (params.responseSchema && !modelSupportsStructuredOutputs(params.model)) {
    throw new Error(
      `Model ${params.model} does not support structured outputs. ` +
        `Supported models: ${[...STRUCTURED_OUTPUT_MODELS].join(', ')}`
    );
  }

  const generation = startObservation(
    params.observationName ?? 'openrouter-call',
    {
      model: params.model,
      input: params.messages,
      ...(params.prompt && { prompt: params.prompt }),
      ...(params.tags && { tags: params.tags }),
      ...(params.metadata && { metadata: params.metadata }),
    },
    { asType: 'generation' }
  );

  try {
    const adapter = createAdapter(params.model, params.apiKey);
    const { systemPrompts, messages } = convertMessages(params.messages);

    const result = await chat({
      adapter,
      messages,
      systemPrompts,
      stream: false,
      maxTokens: params.max_tokens,
      temperature: params.temperature,
      topP: params.top_p,
      modelOptions: buildModelOptions(params),
    });

    generation.update({ output: result }).end();
    return result;
  } catch (error) {
    generation
      .update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      })
      .end();
    throw error;
  }
}

/**
 * Stream OpenRouter responses chunk by chunk
 * Yields StreamChunk objects compatible with existing callers
 */
export async function* callOpenRouterStream(
  params: OpenRouterRequestParams
): AsyncGenerator<StreamChunk> {
  // Validate model supports structured outputs if schema is provided
  if (params.responseSchema && !modelSupportsStructuredOutputs(params.model)) {
    throw new Error(
      `Model ${params.model} does not support structured outputs. ` +
        `Supported models: ${[...STRUCTURED_OUTPUT_MODELS].join(', ')}`
    );
  }

  const generation = startObservation(
    params.observationName ?? 'openrouter-stream',
    {
      model: params.model,
      input: params.messages,
      ...(params.prompt && { prompt: params.prompt }),
      ...(params.tags && { tags: params.tags }),
      ...(params.metadata && { metadata: params.metadata }),
    },
    { asType: 'generation' }
  );

  let accumulated = '';
  let hasError = false;

  try {
    const adapter = createAdapter(params.model, params.apiKey);
    const { systemPrompts, messages } = convertMessages(params.messages);

    const stream = chat({
      adapter,
      messages,
      systemPrompts,
      maxTokens: params.max_tokens,
      temperature: params.temperature,
      topP: params.top_p,
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
        const errorMsg =
          'error' in event && event.error
            ? String(
                typeof event.error === 'object' && 'message' in event.error
                  ? event.error.message
                  : event.error
              )
            : 'Unknown stream error';
        generation.update({ level: 'ERROR', statusMessage: errorMsg }).end();
        throw new Error(`OpenRouter stream error: ${errorMsg}`);
      }
    }

    // Stream ended normally
    yield { delta: '', accumulated, done: true };
  } catch (error) {
    if (!hasError) {
      generation
        .update({
          level: 'ERROR',
          statusMessage: error instanceof Error ? error.message : String(error),
        })
        .end();
    }
    throw error;
  } finally {
    if (!hasError) {
      generation.update({ output: accumulated }).end();
    }
  }
}

/**
 * Helper function to create a system message
 */
export function systemMessage(content: string): OpenRouterMessage {
  return { role: 'system', content };
}

/**
 * Helper function to create a user message
 */
export function userMessage(content: string): OpenRouterMessage {
  return { role: 'user', content };
}

/**
 * Helper function to create an assistant message
 */
export function assistantMessage(content: string): OpenRouterMessage {
  return { role: 'assistant', content };
}

/**
 * Extract JSON from a potentially wrapped response
 * @param content - The content string to parse
 * @param schema - Optional Zod schema to validate and type the result
 * @returns Parsed JSON as unknown (caller must validate), or typed T if schema provided
 */
export function extractJSON<T>(
  content: string,
  schema?: z.ZodType<T>
): T | null {
  const parseAndValidate = (jsonString: string): T | null => {
    const parsed: unknown = JSON.parse(jsonString);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      console.error('Schema validation failed:', result.error.message);
      return null;
    }
    // When no schema provided, return as T (caller takes responsibility for type safety)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Intentional: function signature indicates optional validation
    return parsed as T;
  };

  try {
    // Try direct parse first
    return parseAndValidate(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.log('Failed to parse JSON from markdown direct parse');
    } else if (error instanceof Error) {
      console.log(
        'Failed to parse JSON from markdown direct parse:',
        error.message
      );
    } else {
      console.log('Failed to parse JSON from markdown direct parse:');
    }
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    if (jsonMatch) {
      try {
        const result = parseAndValidate(jsonMatch[1]);
        if (result !== null) {
          console.log('parsed from markdown code blocks');
          return result;
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error('Failed to parse JSON from markdown code blocks:', {
            cause: error.cause,
            message: error.message,
            stack: error.stack,
          });
        } else if (error instanceof Error) {
          console.error(
            'Failed to parse JSON from markdown code blocks:',
            error.message
          );
        } else {
          console.error(
            'Failed to parse JSON from markdown code blocks:',
            error
          );
        }
        // Continue to next attempt
      }
    }

    // Try to find JSON object in the text
    const objectMatch = content.match(/{[\s\S]*}/);
    if (objectMatch) {
      try {
        return parseAndValidate(objectMatch[0]);
      } catch {
        console.error('Failed to parse JSON from object match:', objectMatch);
        return null;
      }
    }

    console.error('Failed to parse JSON from content:', content);

    return null;
  }
}
