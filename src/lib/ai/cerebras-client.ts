/**
 * Cerebras API client for ultra-fast AI inference
 * Provides 1,400-3,000 tokens/second throughput
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { z } from 'zod';

// Response schema for Cerebras API (matches OpenAI/OpenRouter structure)
const cerebrasResponseSchema = z.object({
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

export type CerebrasResponse = z.infer<typeof cerebrasResponseSchema>;

export type CerebrasMessageContent =
  | string
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant';
  content: CerebrasMessageContent;
}

export interface CerebrasRequestParams {
  model: string;
  messages: CerebrasMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  response_format?:
    | {
        type: 'json_object';
      }
    | {
        type: 'json_schema';
        json_schema: {
          name: string;
          strict: boolean;
          schema: Record<string, unknown>;
        };
      };
}

/**
 * Create Cerebras client instance
 */
function getCerebrasClient(): Cerebras {
  const apiKey = process.env.CEREBRAS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'CEREBRAS_API_KEY environment variable is required but not set'
    );
  }

  return new Cerebras({
    apiKey,
  });
}

/**
 * Make a request to Cerebras API
 */
export async function callCerebras(
  params: CerebrasRequestParams
): Promise<CerebrasResponse> {
  try {
    const client = getCerebrasClient();

    // Strip the "cerebras/" prefix if present (used for internal routing)
    // Cerebras API expects model IDs like "llama3.1-8b", not "cerebras/llama3.1-8b"
    const modelId = params.model.startsWith('cerebras/')
      ? params.model.slice('cerebras/'.length)
      : params.model;

    const response = await client.chat.completions.create({
      model: modelId,
      messages: params.messages as Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>,
      ...(params.temperature !== undefined && {
        temperature: params.temperature,
      }),
      ...(params.max_tokens !== undefined && {
        max_tokens: params.max_tokens,
      }),
      ...(params.top_p !== undefined && { top_p: params.top_p }),
      ...(params.stream !== undefined && { stream: params.stream }),
      ...(params.response_format !== undefined && {
        response_format: params.response_format,
      }),
    });

    // Validate response structure
    const validated = cerebrasResponseSchema.parse(response);

    return validated;
  } catch (error) {
    console.error('[Cerebras] Request failed:', error);
    throw error;
  }
}

/**
 * Helper function to create a system message
 */
export function systemMessage(content: string): CerebrasMessage {
  return { role: 'system', content };
}

/**
 * Helper function to create a user message
 */
export function userMessage(content: string): CerebrasMessage {
  return { role: 'user', content };
}

/**
 * Helper function to create an assistant message
 */
export function assistantMessage(content: string): CerebrasMessage {
  return { role: 'assistant', content };
}
