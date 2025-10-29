/**
 * Cerebras API client for ultra-fast AI inference
 * Provides 1,400-3,000 tokens/second throughput
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';

export type CerebrasRequestParams = Omit<
  Cerebras.Chat.ChatCompletionCreateParams,
  'stream'
> & { stream?: false };

export type CerebrasResponse = Cerebras.Chat.ChatCompletion;

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
      messages: params.messages,
      stream: false, // We don't use streaming
      ...(params.temperature !== undefined && {
        temperature: params.temperature,
      }),
      ...(params.max_tokens !== undefined && {
        max_tokens: params.max_tokens,
      }),
      ...(params.top_p !== undefined && { top_p: params.top_p }),
      ...(params.response_format !== undefined && {
        response_format: params.response_format,
      }),
    });

    // Since stream=false, response is always ChatCompletion (not a stream)
    return response as CerebrasResponse;
  } catch (error) {
    console.error('[Cerebras] Request failed:', error);
    throw error;
  }
}

/**
 * Helper function to create a system message
 */
export function systemMessage(content: string) {
  return { role: 'system' as const, content };
}

/**
 * Helper function to create a user message
 */
export function userMessage(content: string) {
  return { role: 'user' as const, content };
}

/**
 * Helper function to create an assistant message
 */
export function assistantMessage(content: string) {
  return { role: 'assistant' as const, content };
}
