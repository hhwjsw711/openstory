/**
 * OpenRouter API client for AI services
 * Provides a unified interface to multiple AI models
 */

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

export type OpenRouterResponse = z.infer<typeof openRouterResponseSchema>;

export type OpenRouterMessageContent =
  | string
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenRouterMessageContent;
}

export interface OpenRouterRequestParams {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

/**
 * Model recommendations for different tasks
 */
export const RECOMMENDED_MODELS = {
  // For creative writing and scene descriptions
  creative: 'anthropic/claude-sonnet-4.5',

  // For structured data extraction
  structured: 'anthropic/claude-sonnet-4.5',

  // For fast responses with good quality
  fast: 'anthropic/claude-haiku-4.5',

  // For highest quality (more expensive)
  premium: 'anthropic/claude-sonnet-4.5',
} as const;

/**
 * Make a request to OpenRouter API
 */
export async function callOpenRouter(
  params: OpenRouterRequestParams
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_KEY environment variable is required but not set'
    );
  }

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
 */
export function extractJSON<T>(content: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Failed to parse JSON from direct parse:', error);
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as T;
        console.log('parsed from markdown code blocks');
        return parsed;
      } catch (error) {
        console.error('Failed to parse JSON from markdown code blocks:', error);
        // Continue to next attempt
      }
    }

    // Try to find JSON object in the text
    const objectMatch = content.match(/{[\s\S]*}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        console.error('Failed to parse JSON from object match:', content);
        return null;
      }
    }

    return null;
  }
}
