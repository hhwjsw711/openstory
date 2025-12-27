/**
 * Langfuse Prompt Management
 * Fetches prompts from Langfuse and returns them for trace linking
 */

import { getEnv } from '#env';
import { LangfuseClient, type TextPromptClient } from '@langfuse/client';

let client: LangfuseClient | null = null;

function getClient(): LangfuseClient {
  if (!client) {
    const env = getEnv();
    if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
      throw new Error('Langfuse credentials not configured');
    }
    client = new LangfuseClient({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    });
  }
  return client;
}

/**
 * Fetch a prompt from Langfuse and optionally compile with variables
 *
 * @param name - Prompt name (e.g., 'velro/phase/scene-splitting')
 * @param variables - Optional variables to compile into the prompt
 * @returns The prompt client (for trace linking) and compiled text
 */
export async function getPrompt(
  name: string,
  variables?: Record<string, string>
): Promise<{ prompt: TextPromptClient; compiled: string }> {
  const prompt = await getClient().prompt.get(name, { type: 'text' });
  const compiled = variables ? prompt.compile(variables) : prompt.prompt;
  return { prompt, compiled };
}
