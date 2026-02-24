/**
 * AI Event Bridge
 * Subscribes to TanStack AI events and forwards to Langfuse automatically.
 * Replaces manual per-call startObservation/generation.update().end() instrumentation.
 *
 * Metadata contract: callers pass observability hints via chat({ metadata: { ... } }).
 * TanStack AI places this at event.payload.options.metadata.
 * We parse it with zod since the shape is unknown at the type level.
 */

import { propagateAttributes, startObservation } from '@langfuse/tracing';
import { aiEventClient } from '@tanstack/ai/event-client';
import { z } from 'zod';

const llmMetadataSchema = z.object({
  observationName: z.string().optional(),
  prompt: z
    .object({
      name: z.string(),
      version: z.number(),
      isFallback: z.boolean(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

const inflight = new Map<string, ReturnType<typeof startObservation>>();

export function initAIEventBridge(): void {
  aiEventClient.on(
    'text:request:started',
    (event) => {
      const payload = event.payload;
      const parsed = llmMetadataSchema.safeParse(payload.options?.metadata);
      const meta = parsed.success ? parsed.data : {};
      const name = meta.observationName ?? `${payload.provider}-call`;

      const createObs = () => {
        const obs = startObservation(
          name,
          {
            model: payload.model,
            ...(meta.prompt && { prompt: meta.prompt }),
            ...(meta.tags && { tags: meta.tags }),
            ...(meta.metadata && { metadata: meta.metadata }),
          },
          { asType: 'generation' }
        );
        inflight.set(payload.requestId, obs);
      };

      if (meta.sessionId) {
        propagateAttributes(
          {
            sessionId: meta.sessionId,
            ...(meta.userId && { userId: meta.userId }),
          },
          createObs
        );
      } else {
        createObs();
      }
    },
    { withEventTarget: true }
  );

  aiEventClient.on(
    'text:request:completed',
    (event) => {
      const payload = event.payload;
      const obs = inflight.get(payload.requestId);
      if (!obs) return;
      obs
        .update({
          output: payload.content,
          ...(payload.usage && {
            usageDetails: {
              input: payload.usage.promptTokens,
              output: payload.usage.completionTokens,
            },
          }),
        })
        .end();
      inflight.delete(payload.requestId);
    },
    { withEventTarget: true }
  );

  aiEventClient.on(
    'text:chunk:error',
    (event) => {
      const payload = event.payload;
      const reqId = payload.requestId ?? payload.streamId;
      const obs = inflight.get(reqId);
      if (!obs) return;
      obs.update({ level: 'ERROR', statusMessage: payload.error }).end();
      inflight.delete(reqId);
    },
    { withEventTarget: true }
  );
}
