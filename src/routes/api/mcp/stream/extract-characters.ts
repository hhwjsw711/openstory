/**
 * SSE Streaming endpoint for extract-characters
 * Streams LLM response back to clients in real-time
 */

import {
  extractCharactersInputSchema,
  extractCharactersTool,
  type ExtractCharactersInput,
} from '@/lib/mcp/tools/extract-characters';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/mcp/stream/extract-characters')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = extractCharactersInputSchema.parse(
            body
          ) satisfies ExtractCharactersInput;

          const stream = createSSEStream(async (emit) => {
            emit.progress(0, 100, 'Starting character extraction...');

            const result = await extractCharactersTool(input, (progress) => {
              if (progress.type === 'chunk') {
                const estimatedProgress = Math.min(
                  progress.text.length / 1000,
                  0.95
                );
                emit.progress(
                  Math.round(estimatedProgress * 100),
                  100,
                  'Extracting characters...'
                );
                emit.chunk(1, 'Character Extraction', progress.text);
              } else if (progress.type === 'complete') {
                emit.progress(100, 100, 'Character extraction complete');
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
