/**
 * QStash Workflow client configuration
 */

import { Client } from "@upstash/qstash";
import { ConfigurationError } from "@/lib/errors";
import {
  getInternalAppUrl,
  getQStashWebhookUrl,
} from "@/lib/utils/get-base-url";

/**
 * Gets the QStash client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
export function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      "QSTASH_TOKEN environment variable is required"
    );
  }

  return new Client({ token });
}

/**
 * Gets the external webhook base URL for workflow endpoints
 * Used by QStash to call back to workflows
 */
export function getWorkflowBaseUrl(): string {
  const apiUrl = getQStashWebhookUrl();
  return `${apiUrl}/api/workflows`;
}

/**
 * Gets the internal base URL for workflow endpoints
 * Used when API routes need to trigger workflows within the same app
 */
export function getInternalWorkflowBaseUrl(): string {
  const appUrl = getInternalAppUrl();
  return `${appUrl}/api/workflows`;
}

/**
 * Configuration for workflow runtime
 */
export const workflowConfig = {
  /**
   * External webhook base URL (for QStash callbacks)
   */
  baseUrl: getWorkflowBaseUrl(),

  /**
   * Internal base URL (for API route → workflow calls)
   */
  internalBaseUrl: getInternalWorkflowBaseUrl(),

  /**
   * Default retry configuration
   */
  retries: 3,

  /**
   * Default timeout for workflow steps (in seconds)
   */
  timeout: 300, // 5 minutes
} as const;
