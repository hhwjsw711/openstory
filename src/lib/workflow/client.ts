/**
 * QStash Workflow client configuration
 */

import { ConfigurationError } from '@/lib/errors';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { Client } from '@upstash/qstash';

/**
 * Gets the QStash client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      'QSTASH_TOKEN environment variable is required'
    );
  }

  return new Client({ token });
}

/**
 * Gets the external webhook base URL for workflow endpoints
 * Used by QStash to call back to workflows
 */
function getWorkflowBaseUrl(): string {
  const apiUrl = getQStashWebhookUrl();
  return `${apiUrl}/api/workflows`;
}

export async function publishWorkflow(url: string, body: object) {
  const qstash = getQStashClient();
  const baseUrl = getWorkflowBaseUrl();
  const response = await qstash.publishJSON({
    url: `${baseUrl}${url}`,
    body: body,
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {},
  });
  return typeof response === 'object' && 'messageId' in response
    ? response.messageId
    : null;
}
