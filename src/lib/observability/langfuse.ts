/**
 * Langfuse Observability Integration
 * OpenTelemetry-based tracing for LLM and media generation
 */

import { getEnv } from '#env';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';
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

/**
 * Wrap execution with Langfuse session context.
 * All traces created within fn() will be grouped by sessionId in Langfuse.
 *
 * @param sequenceId - Used as the Langfuse sessionId to group traces
 * @param userId - Optional user ID for user attribution
 * @param fn - Async function to execute within the session context
 */
export async function withSequenceSession<T>(
  sequenceId: string,
  userId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return propagateAttributes(
    {
      sessionId: sequenceId,
      ...(userId && { userId }),
    },
    fn
  );
}

/**
 * Wrap a workflow execution with a root Langfuse trace.
 * Creates a parent trace that contains all LLM calls and can be evaluated end-to-end.
 *
 * @param traceName - Name for the root trace (e.g., 'analyzeScriptWorkflow')
 * @param input - Input data to log on the trace
 * @param sequenceId - Used as the Langfuse sessionId to group traces
 * @param userId - Optional user ID for user attribution
 * @param fn - Async function that returns the workflow output
 */
export async function withWorkflowTrace<TInput, TOutput>(
  traceName: string,
  input: TInput,
  sequenceId: string,
  userId: string | undefined,
  fn: () => Promise<TOutput>
): Promise<TOutput> {
  return propagateAttributes(
    {
      sessionId: sequenceId,
      ...(userId && { userId }),
    },
    async () => {
      return startActiveObservation(
        traceName,
        async (span) => {
          span.update({ input });

          const output = await fn();

          span.update({ output });
          return output;
        },
        { asType: 'span' }
      );
    }
  );
}
