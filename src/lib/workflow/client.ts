/**
 * QStash Workflow client configuration
 */

import { getEnv } from '#env';
import { ConfigurationError } from '@/lib/errors';
import { getQStashWebhookUrl } from '@/lib/utils/get-base-url';
import { Client } from '@upstash/workflow';
/**
 * Gets the QStash client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
function getQStashClient(): Client {
  const env = getEnv();
  const token = env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      'QSTASH_TOKEN environment variable is required'
    );
  }

  return new Client({
    token,
    headers: {
      'x-vercel-protection-bypass':
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '',
    },
  });
}

/**
 * Gets the external webhook base URL for workflow endpoints
 * Used by QStash to call back to workflows
 */
function getWorkflowBaseUrl(): string {
  const apiUrl = getQStashWebhookUrl();
  return `${apiUrl}/api/workflows`;
}

export async function triggerWorkflow(
  url: string,
  body: object,
  options?: {
    deduplicationId?: string;
  }
) {
  const qstash = getQStashClient();
  const baseUrl = getWorkflowBaseUrl();

  const response = await qstash.trigger({
    url: `${baseUrl}${url}`,
    body: body,
    keepTriggerConfig: true,
    // Use deduplicationId as workflowRunId to prevent duplicate runs
    // Each workflow run must have a unique ID - if the ID exists, no duplicate is created
    workflowRunId: options?.deduplicationId,
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'Upstash-Forward-X-Vercel-Protection-Bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : undefined,
  });
  return response.workflowRunId;
}

export async function cancelWorkflow(workflowId: string) {
  const qstash = getQStashClient();
  const response = await qstash.cancel({ ids: [workflowId] });
  return response.cancelled;
}
