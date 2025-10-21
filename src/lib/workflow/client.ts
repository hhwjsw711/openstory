/**
 * QStash Workflow client configuration
 */

import { Client } from "@upstash/qstash";
import { ConfigurationError } from "@/lib/errors";
import { getQStashWebhookUrl } from "@/lib/utils/get-base-url";

/**
 * Gets the QStash client for direct API operations
 * Most workflow operations should use the serve() function in route files
 */
export function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    throw new ConfigurationError(
      "QSTASH_TOKEN environment variable is required",
    );
  }

  return new Client({ token });
}

/**
 * Gets the base URL for workflow endpoints
 * Workflow serve() functions use this to construct their URLs
 */
export function getWorkflowBaseUrl(): string {
  const apiUrl = getQStashWebhookUrl();
  return `${apiUrl}/api/workflows`;
}

/**
 * Configuration for workflow runtime
 */
export const workflowConfig = {
  /**
   * Base URL for all workflow endpoints
   */
  baseUrl: getWorkflowBaseUrl(),

  /**
   * Default retry configuration
   */
  retries: 3,

  /**
   * Default timeout for workflow steps (in seconds)
   */
  timeout: 300, // 5 minutes
} as const;
