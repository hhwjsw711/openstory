/**
 * SSE Streaming endpoint for split-scenes
 * Streams LLM response back to clients in real-time
 */

import {
  splitScenesInputSchema,
  splitScenesTool,
  type SplitScenesInput,
} from '@/lib/mcp/tools/split-scenes';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/mcp/stream/split-scenes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = splitScenesInputSchema.parse(
            body
          ) satisfies SplitScenesInput;

          const stream = createSSEStream(async (emit) => {
            emit.progress(0, 100, 'Starting scene splitting...');

            const result = await splitScenesTool(input, (progress) => {
              if (progress.type === 'chunk') {
                const estimatedProgress = Math.min(
                  progress.text.length / 1000,
                  0.95
                );
                emit.progress(
                  Math.round(estimatedProgress * 100),
                  100,
                  'Splitting scenes...'
                );
                emit.chunk(1, 'Scene Splitting', progress.text);
              } else if (progress.type === 'complete') {
                emit.progress(100, 100, 'Scene splitting complete');
              }
            });

            return result;
          });

          return new Response(stream, { headers: SSE_HEADERS });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Invalid input', details: error.issues }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          const message =
            error instanceof Error ? error.message : 'Unknown error';
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
