/**
 * QStash Workflow client configuration
 */

import { getEnv } from '#env';
import { ConfigurationError } from '@/lib/errors';
import { Client as WorkflowClient } from '@upstash/workflow';
import { Client as QStashClient } from '@upstash/qstash';

import { getServerAppUrl } from '../utils/environment';
import { getRequest } from '@tanstack/react-start/server';
/**
 * Gets the QStash Workflow client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
function getWorkflowClient(): WorkflowClient {
  const env = getEnv();
  const token = env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      'QStash is not configured. Run `bun setup` and enable workflows, or start the emulator with `bun qstash:dev`.'
    );
  }

  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return new WorkflowClient({
    token,
    headers: bypassSecret
      ? {
          'Upstash-Forward-X-Vercel-Protection-Bypass': bypassSecret,
          'x-vercel-protection-bypass': bypassSecret,
          'upstash-callback-forward-X-Vercel-Protection-Bypass': bypassSecret,
          'upstash-failure-callback-forward-X-Vercel-Protection-Bypass':
            bypassSecret,
        }
      : undefined,
  });
}

/**
 * Gets the QStash Workflow client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
export function getQStashClient(): QStashClient {
  const env = getEnv();
  const token = env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      'QStash is not configured. Run `bun setup` and enable workflows, or start the emulator with `bun qstash:dev`.'
    );
  }

  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return new QStashClient({
    token,
    headers: bypassSecret
      ? {
          'Upstash-Forward-X-Vercel-Protection-Bypass': bypassSecret,
          'x-vercel-protection-bypass': bypassSecret,
          'upstash-callback-forward-X-Vercel-Protection-Bypass': bypassSecret,
          'upstash-failure-callback-forward-X-Vercel-Protection-Bypass':
            bypassSecret,
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
  console.log('[TriggerWorkflow] URL:', url);
  console.log('[TriggerWorkflow] Body:', body);
  console.log('[TriggerWorkflow] Options:', options);
  // Skip workflow triggers in E2E tests - return mock ID
  if (getEnv().E2E_TEST === 'true') {
    const mockId = options?.deduplicationId ?? `mock-${Date.now()}`;
    console.log(`[E2E] Skipping workflow trigger: ${url} (mock ID: ${mockId})`);
    return mockId;
  }

  const qstash = getWorkflowClient();
  const request = getRequest();
  const baseUrl = getWorkflowBaseUrl(request);

  const response = await qstash.trigger({
    url: `${baseUrl}${url}`,
    body: body,
    keepTriggerConfig: true,
    // Use deduplicationId as workflowRunId to prevent duplicate runs
    // Each workflow run must have a unique ID - if the ID exists, no duplicate is created
    workflowRunId: options?.deduplicationId,
    headers: (() => {
      const bypassSecret = getEnv().VERCEL_AUTOMATION_BYPASS_SECRET;
      return bypassSecret
        ? {
            'Upstash-Forward-X-Vercel-Protection-Bypass': bypassSecret,
            'X-Vercel-Protection-Bypass': bypassSecret,
            'upstash-callback-forward-X-Vercel-Protection-Bypass': bypassSecret,
            'upstash-failure-callback-forward-X-Vercel-Protection-Bypass':
              bypassSecret,
          }
        : undefined;
    })(),
  });
  console.log('[TriggerWorkflow] Response:', response);
  return response.workflowRunId;
}

export async function cancelWorkflow(workflowId: string) {
  const qstash = getWorkflowClient();
  const response = await qstash.cancel({ ids: [workflowId] });
  return response.cancelled;
}
