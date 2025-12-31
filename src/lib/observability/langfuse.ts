/**
 * Langfuse Observability Integration
 * OpenTelemetry-based tracing for LLM and media generation
 */

import { getEnv } from '#env';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
  propagateAttributes,
  startActiveObservation,
  startObservation,
} from '@langfuse/tracing';
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

/**
 * Prompt reference for Langfuse trace linking.
 * Compatible with TextPromptClient and ChatPromptClient from @langfuse/client.
 */
type PromptReference = {
  name: string;
  version: number;
  isFallback: boolean;
};

/**
 * Usage details from an LLM API response.
 * Compatible with OpenRouter and OpenAI response formats.
 */
export type LLMUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  cost?: number;
};

/**
 * Extract typed usage from unknown LLM response usage.
 * Returns undefined if the usage object doesn't have the expected shape.
 */
function extractUsage(usage: unknown): LLMUsage | undefined {
  if (
    typeof usage === 'object' &&
    usage !== null &&
    'prompt_tokens' in usage &&
    'completion_tokens' in usage &&
    typeof (usage as Record<string, unknown>).prompt_tokens === 'number' &&
    typeof (usage as Record<string, unknown>).completion_tokens === 'number'
  ) {
    const u = usage as Record<string, unknown>;
    return {
      prompt_tokens: u.prompt_tokens as number,
      completion_tokens: u.completion_tokens as number,
      cost: typeof u.cost === 'number' ? u.cost : undefined,
    };
  }
  return undefined;
}

/**
 * Options for logging a generation to Langfuse.
 */
type LogGenerationOptions = {
  /** Observation name for filtering in Langfuse (e.g., 'phase-2-character-extraction') */
  name: string;
  /** Model ID used for the generation */
  model: string;
  /** Input messages sent to the LLM */
  input: unknown;
  /** Output content from the LLM */
  output: string;
  /** Usage details from the LLM response (can be unknown - will be safely extracted) */
  usage?: unknown;
  /** Prompt reference for trace linking (from getPrompt or getChatPrompt) */
  prompt?: PromptReference;
  /** Tags for filtering in Langfuse */
  tags?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Custom start time (for precise timing when LLM call was made in a previous step) */
  startTime?: Date;
};

/**
 * Log a completed LLM generation to Langfuse with usage and cost tracking.
 *
 * Use this helper to log LLM calls made via context.api.openai in QStash workflows,
 * where the LLM call happens in a separate durable step from the logging.
 *
 * @example
 * ```typescript
 * // In a workflow context.run() step after an LLM call:
 * logGeneration({
 *   name: 'phase-2-character-extraction',
 *   model: 'anthropic/claude-sonnet-4',
 *   input: messages,
 *   output: response.choices[0]?.message?.content ?? '',
 *   usage: response.usage,
 *   prompt: promptClient,
 *   tags: ['character-extraction', 'phase-2'],
 *   metadata: { phase: 2, phaseName: 'Character Extraction' },
 *   startTime: new Date(startTimeMs),
 * });
 * ```
 */
export function logGeneration(options: LogGenerationOptions): void {
  const generation = startObservation(
    options.name,
    {
      model: options.model,
      input: options.input,
      ...(options.prompt && { prompt: options.prompt }),
      ...(options.tags && { tags: options.tags }),
      ...(options.metadata && { metadata: options.metadata }),
    },
    {
      asType: 'generation',
      ...(options.startTime && { startTime: options.startTime }),
    }
  );

  const usage = extractUsage(options.usage);

  generation
    .update({
      output: options.output,
      usageDetails: usage
        ? {
            input: usage.prompt_tokens,
            output: usage.completion_tokens,
          }
        : undefined,
      costDetails: usage?.cost ? { total: usage.cost } : undefined,
    })
    .end();
}
