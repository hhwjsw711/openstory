/**
 * SSE Streaming endpoint for analyze-script
 * Streams phase progress back to clients in real-time
 */

import {
  analyzeScriptInputSchema,
  analyzeScriptTool,
  type AnalyzeScriptInput,
} from '@/lib/mcp/tools/analyze-script';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/mcp/stream/analyze-script')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = analyzeScriptInputSchema.parse(body) satisfies AnalyzeScriptInput;

          const stream = createSSEStream(async (emit) => {
            // Emit initial progress
            emit.progress(0, 100, 'Starting script analysis...');

            const result = await analyzeScriptTool(
              input,
              (phase, phaseName, progress, chunk) => {
                // Calculate overall progress (5 phases, 20% each)
                const overallProgress = (phase - 1) * 20 + progress * 0.2;
                emit.progress(
                  Math.round(overallProgress),
                  100,
                  `Phase ${phase}/5: ${phaseName} (${Math.round(progress)}%)`
                );

                // Stream the actual LLM text chunk if present
                if (chunk) {
                  emit.chunk(phase, phaseName, chunk);
                }
              }
            );

            emit.progress(100, 100, 'Analysis complete');
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
