/**
 * SSE Streaming endpoint for generate-visual-prompts
 * Streams LLM response back to clients in real-time
 */

import {
  generateVisualPromptsInputSchema,
  generateVisualPromptsTool,
  type GenerateVisualPromptsInput,
} from '@/lib/mcp/tools/generate-visual-prompts';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/mcp/stream/visual-prompts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = generateVisualPromptsInputSchema.parse(
            body
          ) satisfies GenerateVisualPromptsInput;

          const stream = createSSEStream(async (emit) => {
            emit.progress(0, 100, 'Starting visual prompt generation...');

            const result = await generateVisualPromptsTool(
              input,
              (progress) => {
                if (progress.type === 'chunk') {
                  const estimatedProgress = Math.min(
                    progress.text.length / 1000,
                    0.95
                  );
                  emit.progress(
                    Math.round(estimatedProgress * 100),
                    100,
                    'Generating visual prompts...'
                  );
                  emit.chunk(1, 'Visual Prompt Generation', progress.text);
                } else if (progress.type === 'complete') {
                  emit.progress(100, 100, 'Visual prompt generation complete');
                }
              }
            );

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
