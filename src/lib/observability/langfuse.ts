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

type WorkflowTraceOptions = {
  model?: string;
  durationMs?: number;
};

/**
 * Record a completed workflow trace to Langfuse.
 * Call inside context.run() to ensure it only runs once (durable step).
 *
 * @param traceName - Name for the trace (e.g., 'analyzeScriptWorkflow')
 * @param input - Input data that was passed to the workflow
 * @param output - Output data produced by the workflow
 * @param sequenceId - Used as the Langfuse sessionId to group traces
 * @param userId - Optional user ID for user attribution
 * @param options - Optional model and durationMs for the trace
 */
export async function recordWorkflowTrace<TInput, TOutput>(
  traceName: string,
  input: TInput,
  output: TOutput,
  sequenceId: string,
  userId: string | undefined,
  options?: WorkflowTraceOptions
): Promise<void> {
  await propagateAttributes(
    {
      sessionId: sequenceId,
      ...(userId && { userId }),
      ...((options?.model || options?.durationMs) && {
        tags: options?.model ? [`model:${options.model}`] : [],
        metadata: {
          ...(options?.model && { model: options.model }),
          ...(options?.durationMs && {
            durationMs: String(options.durationMs),
          }),
        },
      }),
    },
    async () => {
      await startActiveObservation(
        traceName,
        async (generation) => {
          generation.update({
            input,
            output: typeof output === 'object' ? output : { result: output },
            ...(options?.model && { model: options.model }),
          });
        },
        { asType: 'generation' }
      );
    }
  );
}
