/**
 * Fal.ai Webhook Utilities
 * Shared utilities for integrating fal.ai with Upstash Workflow webhooks
 *
 * @see https://docs.fal.ai/model-apis/model-endpoints/webhooks
 */

import { getEnv } from '#env';

/**
 * Fal webhook response payload structure
 * When fal completes, it POSTs to the webhook URL with this structure
 */
export type FalWebhookPayload<T = unknown> = {
  request_id: string;
  gateway_request_id?: string;
  status: 'OK' | 'ERROR';
  payload?: T;
  error?: string;
};

/**
 * Fal video generation result from webhook
 */
export type FalVideoResult = {
  video: {
    url: string;
    file_name?: string;
    file_size?: number;
    content_type?: string;
  };
};

/**
 * Fal image generation result from webhook
 */
export type FalImageResult = {
  images: Array<{
    url: string;
    width?: number;
    height?: number;
    file_size?: number;
    content_type?: string;
  }>;
  timings?: { inference?: number };
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
};

/**
 * Build the fal queue URL with webhook parameter
 *
 * Uses queue.fal.run instead of fal.run to enable async webhook callbacks.
 * The fal_webhook parameter tells fal where to POST the result when done.
 *
 * @param modelId - The fal model ID (e.g., "fal-ai/kling-video/v2.5-turbo/pro/image-to-video")
 * @param webhookUrl - The Upstash Workflow webhook URL to callback when complete
 * @returns The complete URL to POST to for queue submission
 *
 * @example
 * const url = buildFalQueueUrl(
 *   "fal-ai/flux/dev",
 *   "https://qstash.upstash.io/v2/publish/..."
 * );
 * // Returns: "https://queue.fal.run/fal-ai/flux/dev?fal_webhook=https%3A%2F%2Fqstash.upstash.io%2F..."
 */
export function buildFalQueueUrl(modelId: string, webhookUrl: string): string {
  const baseUrl = `https://queue.fal.run/${modelId}`;
  const encodedWebhook = webhookUrl;
  return `${baseUrl}?fal_webhook=${encodedWebhook}`;
}

/**
 * Get authorization headers for fal.ai API calls
 *
 * @returns Headers object with Authorization and Content-Type
 * @throws Error if FAL_KEY is not set
 */
export function getFalAuthHeaders(): Record<string, string> {
  const falKey = getEnv().FAL_KEY;

  if (!falKey) {
    throw new Error('FAL_KEY environment variable is required');
  }

  return {
    Authorization: `Key ${falKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Response from fal queue submission
 * Returned immediately when you POST to queue.fal.run
 */
export type FalQueueSubmitResponse = {
  request_id: string;
  gateway_request_id?: string;
};

/**
 * Parse and validate the fal webhook response from Upstash Workflow
 *
 * When fal calls the webhook, Upstash captures the request.
 * This function extracts and validates the payload from that captured request.
 *
 * @param webhookResult - The result from context.waitForWebhook()
 * @returns The parsed fal webhook payload
 * @throws Error if the webhook timed out or fal returned an error
 *
 * @example
 * const webhookResult = await context.waitForWebhook('wait-for-fal', webhook, '10m');
 * const { video } = parseFalWebhookResponse<FalVideoResult>(webhookResult);
 * console.log(video.url);
 */
/**
 * Type guard to check if a value is a FalWebhookPayload
 */
function isFalWebhookPayload<T>(value: unknown): value is FalWebhookPayload<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // Use 'in' operator for safe property checking
  return (
    'request_id' in value &&
    typeof value.request_id === 'string' &&
    'status' in value &&
    (value.status === 'OK' || value.status === 'ERROR')
  );
}

export function parseFalWebhookResponse<T>(body: Record<string, unknown>): T {
  if (!isFalWebhookPayload<T>(body)) {
    throw new Error('Invalid fal webhook payload format');
  }

  if (body.status === 'ERROR') {
    throw new Error(body.error || 'Fal generation failed');
  }

  if (!body.payload) {
    throw new Error('Fal webhook response missing payload');
  }

  return body.payload;
}

/**
 * Parse video URL from fal webhook response
 *
 * Convenience wrapper for parsing video generation results.
 *
 * @param webhookResult - The result from context.waitForWebhook()
 * @returns The video URL and metadata
 * @throws Error if the webhook timed out, fal returned an error, or no video URL
 */
export function parseFalVideoWebhookResponse(
  body: Record<string, unknown>
): FalVideoResult {
  const result = parseFalWebhookResponse<FalVideoResult>(body);

  if (!result.video?.url) {
    throw new Error('No video URL in fal webhook response');
  }

  return result;
}

/**
 * Parse image URLs from fal webhook response
 *
 * Convenience wrapper for parsing image generation results.
 *
 * @param webhookResult - The result from context.waitForWebhook()
 * @returns The image URLs and metadata
 * @throws Error if the webhook timed out, fal returned an error, or no images
 */
export function parseFalImageWebhookResponse(
  body: Record<string, unknown>
): FalImageResult {
  const result = parseFalWebhookResponse<FalImageResult>(body);

  if (!result.images?.length || !result.images[0].url) {
    throw new Error('No image URLs in fal webhook response');
  }

  return result;
}
