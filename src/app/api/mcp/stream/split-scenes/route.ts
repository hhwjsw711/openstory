/**
 * SSE Streaming endpoint for split-scenes
 * Streams LLM response back to clients in real-time
 */

import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';
import {
  splitScenesTool,
  type SplitScenesInput,
} from '@/lib/mcp/tools/split-scenes';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { z } from 'zod';

const requestSchema = z.object({
  script: z.string().min(1, 'Script is required'),
  aspectRatio: aspectRatioSchema.optional().default('16:9'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body) as SplitScenesInput;

    const stream = createSSEStream(async (emit) => {
      emit.progress(0, 100, 'Starting scene splitting...');

      const result = await splitScenesTool(input, (progress) => {
        if (progress.type === 'chunk') {
          const estimatedProgress = Math.min(progress.text.length / 1000, 0.95);
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

    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
