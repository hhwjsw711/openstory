/**
 * OpenRouter API client for AI services
 * Provides a unified interface to multiple AI models
 */

import { getEnv } from '#env';
import type { PromptReference } from '@/lib/observability/langfuse';
import { startObservation } from '@langfuse/tracing';
import { z } from 'zod';
// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Response schema for OpenRouter API
const openRouterResponseSchema = z.object({
  id: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string().nullable(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      cost: z.number().optional(),
    })
    .optional(),
  model: z.string(),
});

export type OpenRouterResponse = z.infer<typeof openRouterResponseSchema>;

export { openRouterResponseSchema };

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

type OpenRouterRequestParams = {
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
function modelSupportsStructuredOutputs(model: string): boolean {
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
 * Make a request to OpenRouter API
 */
export async function callOpenRouter(
  params: OpenRouterRequestParams
): Promise<OpenRouterResponse> {
  const apiKey = params.apiKey ?? getEnv().OPENROUTER_KEY;

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
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getEnv().APP_URL || 'http://localhost:3000',
        'X-Title': getEnv().APP_NAME || 'AI Video Studio',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        ...(params.temperature !== undefined && {
          temperature: params.temperature,
        }),
        ...(params.max_tokens !== undefined && {
          max_tokens: params.max_tokens,
        }),
        ...(params.top_p !== undefined && { top_p: params.top_p }),
        ...(params.frequency_penalty !== undefined && {
          frequency_penalty: params.frequency_penalty,
        }),
        ...(params.presence_penalty !== undefined && {
          presence_penalty: params.presence_penalty,
        }),
        ...(params.stream !== undefined && { stream: params.stream }),
        provider: params.provider ?? DEFAULT_PROVIDER,
        usage: { include: true },
        // Structured outputs - enforce JSON schema at API level
        ...(params.responseSchema && {
          response_format: buildResponseFormat(
            params.responseSchema,
            params.observationName ?? 'response'
          ),
        }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenRouter] API error:', error);
      generation
        .update({
          level: 'ERROR',
          statusMessage: `API error: ${response.status} ${error}`,
        })
        .end();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const validated = openRouterResponseSchema.parse(data);

    generation
      .update({
        output: validated.choices[0]?.message?.content,
        usageDetails: validated.usage
          ? {
              input: validated.usage.prompt_tokens,
              output: validated.usage.completion_tokens,
            }
          : undefined,
        costDetails: validated.usage?.cost
          ? { total: validated.usage.cost }
          : undefined,
      })
      .end();

    return validated;
  } catch (error) {
    generation
      .update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
      })
      .end();
    console.error('[OpenRouter] Request failed:', error);
    throw error;
  }
}

/**
 * Stream OpenRouter responses chunk by chunk
 */
export async function* callOpenRouterStream(
  params: OpenRouterRequestParams
): AsyncGenerator<StreamChunk> {
  const apiKey = params.apiKey ?? getEnv().OPENROUTER_KEY;

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
  let usage:
    | { prompt_tokens: number; completion_tokens: number; cost?: number }
    | undefined;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getEnv().APP_URL || 'http://localhost:3000',
        'X-Title': getEnv().APP_NAME || 'AI Video Studio',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        ...(params.temperature !== undefined && {
          temperature: params.temperature,
        }),
        ...(params.max_tokens !== undefined && {
          max_tokens: params.max_tokens,
        }),
        ...(params.top_p !== undefined && { top_p: params.top_p }),
        ...(params.frequency_penalty !== undefined && {
          frequency_penalty: params.frequency_penalty,
        }),
        ...(params.presence_penalty !== undefined && {
          presence_penalty: params.presence_penalty,
        }),
        provider: params.provider ?? DEFAULT_PROVIDER,
        stream: true, // Force streaming
        stream_options: { include_usage: true }, // Request usage in final chunk
        usage: { include: true }, // Request cost in response
        // Structured outputs - enforce JSON schema at API level
        ...(params.responseSchema && {
          response_format: buildResponseFormat(
            params.responseSchema,
            params.observationName ?? 'response'
          ),
        }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenRouter] API error:', error);
      hasError = true;
      generation
        .update({
          level: 'ERROR',
          statusMessage: `API error: ${response.status} ${error}`,
        })
        .end();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      hasError = true;
      generation
        .update({
          level: 'ERROR',
          statusMessage: 'No response body reader available',
        })
        .end();
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  if (delta) accumulated += delta;
                  // Capture usage from final chunk if available
                  if (parsed.usage) {
                    usage = {
                      prompt_tokens: parsed.usage.prompt_tokens,
                      completion_tokens: parsed.usage.completion_tokens,
                      cost: parsed.usage.cost,
                    };
                  }
                } catch (e) {
                  console.warn('[OpenRouter] Failed to parse final chunk:', e);
                }
              }
            }
          }
          yield { delta: '', accumulated, done: true };
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);

            if (data === '[DONE]') {
              yield { delta: '', accumulated, done: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';

              // Capture usage from final chunk if available
              if (parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.prompt_tokens,
                  completion_tokens: parsed.usage.completion_tokens,
                  cost: parsed.usage.cost,
                };
              }

              if (delta) {
                accumulated += delta;
                yield { delta, accumulated, done: false };
              }
            } catch {
              // Skip invalid JSON chunks (wait for more data)
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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
      generation
        .update({
          output: accumulated,
          usageDetails: usage
            ? {
                input: usage.prompt_tokens,
                output: usage.completion_tokens,
              }
            : undefined,
          costDetails: usage?.cost ? { total: usage.cost } : undefined,
        })
        .end();
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
