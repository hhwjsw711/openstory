/**
 * SSE Streaming endpoint for generate-motion-prompts
 * Streams LLM response back to clients in real-time
 */

import { sceneSchema } from '@/lib/ai/scene-analysis.schema';
import {
  generateMotionPromptsTool,
  type GenerateMotionPromptsInput,
} from '@/lib/mcp/tools/generate-motion-prompts';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const requestSchema = z.object({
  scenes: z.array(sceneSchema),
});

export const Route = createFileRoute('/api/mcp/stream/motion-prompts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = requestSchema.parse(body) as GenerateMotionPromptsInput;

          const stream = createSSEStream(async (emit) => {
            emit.progress(0, 100, 'Starting motion prompt generation...');

            const result = await generateMotionPromptsTool(
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
                    'Generating motion prompts...'
                  );
                  emit.chunk(1, 'Motion Prompt Generation', progress.text);
                } else if (progress.type === 'complete') {
                  emit.progress(100, 100, 'Motion prompt generation complete');
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
