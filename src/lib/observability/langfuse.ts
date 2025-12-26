/**
 * Langfuse Observability Integration
 * OpenTelemetry-based tracing for LLM and media generation
 */

import { getEnv } from '#env';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

let processor: LangfuseSpanProcessor | null = null;
let sdk: NodeSDK | null = null;

/**
 * Initialize Langfuse tracing.
 * Call once at module load before any traced operations.
 * Silently skips if credentials are not configured.
 */
export function initTracing(): void {
  const env = getEnv();
  const publicKey = env.LANGFUSE_PUBLIC_KEY;
  const secretKey = env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    console.log('[Langfuse] Tracing disabled - credentials not configured');
    return;
  }

  processor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl: env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  });

  sdk = new NodeSDK({
    spanProcessors: [processor],
  });

  sdk.start();
  console.log('[Langfuse] Tracing initialized');
}

/**
 * Flush all pending traces to Langfuse.
 * Call at the end of request handling in serverless environments.
 */
export async function flushTracing(): Promise<void> {
  if (processor) {
    await processor.forceFlush();
  }
}
