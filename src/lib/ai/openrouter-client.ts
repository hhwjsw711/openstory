/**
 * OpenRouter API client for AI services
 * Provides a unified interface to multiple AI models
 */

import { getEnv } from '#env';
import { DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';
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
    })
    .optional(),
  model: z.string(),
});

type OpenRouterResponse = z.infer<typeof openRouterResponseSchema>;

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

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenRouterMessageContent;
}

interface OpenRouterProviderPreference {
  order?: string[];
  only?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
}

interface OpenRouterRequestParams {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  provider?: OpenRouterProviderPreference;
}

/**
 * Default provider preference - prefer Cerebras for speed
 */
const DEFAULT_PROVIDER: OpenRouterProviderPreference = {
  order: ['Cerebras'],
};

/**
 * Model recommendations for different tasks
 */
export const RECOMMENDED_MODELS = {
  // For creative writing and scene descriptions
  creative: 'anthropic/claude-sonnet-4.5',

  // For structured data extraction
  structured: 'anthropic/claude-sonnet-4.5',

  // For fast responses with good quality
  fast: DEFAULT_ANALYSIS_MODEL,

  // For highest quality (more expensive)
  premium: 'anthropic/claude-opus-4.5',
} as const;

/**
 * Make a request to OpenRouter API
 */
export async function callOpenRouter(
  params: OpenRouterRequestParams
): Promise<OpenRouterResponse> {
  const apiKey = getEnv().OPENROUTER_KEY;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://velro.ai',
        'X-Title': 'Velro AI',
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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenRouter] API error:', error);
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const validated = openRouterResponseSchema.parse(data);

    return validated;
  } catch (error) {
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
  const apiKey = getEnv().OPENROUTER_KEY;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://velro.ai',
      'X-Title': 'Velro AI',
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[OpenRouter] API error:', error);
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  let accumulated = '';
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
function assistantMessage(content: string): OpenRouterMessage {
  return { role: 'assistant', content };
}

/**
 * Extract JSON from a potentially wrapped response
 */
export function extractJSON<T>(content: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(content) as T;
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
        const parsed = JSON.parse(jsonMatch[1]) as T;
        console.log('parsed from markdown code blocks');
        return parsed;
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
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        console.error('Failed to parse JSON from object match:', objectMatch);
        return null;
      }
    }

    console.error('Failed to parse JSON from content:', content);

    return null;
  }
}
