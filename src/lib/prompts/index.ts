/**
 * Prompt Management
 *
 * Serves prompts from local workflow-prompts.ts definitions.
 * Simple {{var}} substitution for template variables.
 */

import {
  WORKFLOW_CHAT_PROMPTS,
  WORKFLOW_TEXT_PROMPTS,
} from './workflow-prompts';

/**
 * Simple {{var}} substitution for local prompt templates.
 */
function compileTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => variables[key] ?? ''
  );
}

/**
 * Message format for chat prompts
 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Fetch a text prompt from local definitions.
 *
 * @param name - Prompt name (e.g., 'phase/scene-splitting')
 * @param variables - Optional variables to compile into the prompt
 * @returns The compiled text (prompt ref is always undefined since we use local prompts)
 */
export async function getPrompt(
  name: string,
  variables?: Record<string, string>
): Promise<{ prompt: undefined; compiled: string }> {
  const localPrompt = WORKFLOW_TEXT_PROMPTS[name];
  if (!localPrompt) {
    throw new Error(`Text prompt "${name}" not found in local prompts.`);
  }

  const compiled = variables
    ? compileTemplate(localPrompt, variables)
    : localPrompt;
  return { prompt: undefined, compiled };
}

/**
 * Fetch a chat prompt from local definitions.
 *
 * @param name - Prompt name (e.g., 'phase/scene-splitting')
 * @param variables - Variables to compile into the prompt messages
 * @returns The compiled messages (prompt ref is always undefined since we use local prompts)
 */
export async function getChatPrompt(
  name: string,
  variables?: Record<string, string>
): Promise<{
  prompt: undefined;
  messages: ChatMessage[];
}> {
  const localMessages = WORKFLOW_CHAT_PROMPTS[name];
  if (!localMessages) {
    throw new Error(`Chat prompt "${name}" not found in local prompts.`);
  }

  const messages: ChatMessage[] = variables
    ? localMessages.map((msg) => ({
        ...msg,
        content: compileTemplate(msg.content, variables),
      }))
    : [...localMessages];

  return { prompt: undefined, messages };
}
