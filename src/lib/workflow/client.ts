/**
 * QStash Workflow client configuration
 */

import { getEnv } from '#env';
import { ConfigurationError } from '@/lib/errors';
import { Client } from '@upstash/workflow';
import { getServerAppUrl } from '../utils/environment';
import { getRequest } from '@tanstack/react-start/server';
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
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'Upstash-Forward-X-Vercel-Protection-Bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'x-vercel-protection-bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : undefined,
  });
}

/**
 * Get the URL for QStash webhooks
 * In production, QStash needs a publicly accessible URL
 * In local development, we use a local QStash server that can reach localhost
 */
function getQStashWebhookUrl(request: Request): string {
  // Use centralized APP_URL, but convert localhost to host.docker.internal
  // for QStash running in Docker to reach the Next.js app
  const serverAppUrl = getServerAppUrl(request);
  if (
    serverAppUrl.includes('localhost') ||
    serverAppUrl.includes('127.0.0.1')
  ) {
    const appUrl = new URL(serverAppUrl);
    return `http://host.docker.internal${appUrl.port ? `:${appUrl.port}` : ''}`;
  }

  return serverAppUrl;
}

/**
 * Gets the external webhook base URL for workflow endpoints
 * Used by QStash to call back to workflows
 */
function getWorkflowBaseUrl(request: Request): string {
  const apiUrl = getQStashWebhookUrl(request);
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
  const request = getRequest();
  const baseUrl = getWorkflowBaseUrl(request);

  const response = await qstash.trigger({
    url: `${baseUrl}${url}`,
    body: body,
    keepTriggerConfig: true,
    // Use deduplicationId as workflowRunId to prevent duplicate runs
    // Each workflow run must have a unique ID - if the ID exists, no duplicate is created
    workflowRunId: options?.deduplicationId,
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'Upstash-Forward-X-Vercel-Protection-Bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'X-Vercel-Protection-Bypass':
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : undefined,
  });
  return response.workflowRunId;
}

async function cancelWorkflow(workflowId: string) {
  const qstash = getQStashClient();
  const response = await qstash.cancel({ ids: [workflowId] });
  return response.cancelled;
}
