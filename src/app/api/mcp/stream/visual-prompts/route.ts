/**
 * SSE Streaming endpoint for generate-visual-prompts
 * Streams LLM response back to clients in real-time
 */

import {
  characterBibleEntrySchema,
  sceneSchema,
} from '@/lib/ai/scene-analysis.schema';
import {
  generateVisualPromptsTool,
  type GenerateVisualPromptsInput,
} from '@/lib/mcp/tools/generate-visual-prompts';
import { createSSEStream, SSE_HEADERS } from '@/lib/mcp/utils/sse-stream';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { z } from 'zod';

function getAllStyleNamesTuple(): [string, ...string[]] {
  const names = DEFAULT_STYLE_TEMPLATES.map((style) => style.name);
  if (names.length === 0) {
    throw new Error('No style templates available');
  }
  return names as [string, ...string[]];
}

const requestSchema = z.object({
  scenes: z.array(sceneSchema),
  characterBible: z.array(characterBibleEntrySchema),
  style: z.enum(getAllStyleNamesTuple()),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body) as GenerateVisualPromptsInput;

    const stream = createSSEStream(async (emit) => {
      emit.progress(0, 100, 'Starting visual prompt generation...');

      const result = await generateVisualPromptsTool(input, (progress) => {
        if (progress.type === 'chunk') {
          const estimatedProgress = Math.min(progress.text.length / 1000, 0.95);
          emit.progress(
            Math.round(estimatedProgress * 100),
            100,
            'Generating visual prompts...'
          );
          emit.chunk(1, 'Visual Prompt Generation', progress.text);
        } else if (progress.type === 'complete') {
          emit.progress(100, 100, 'Visual prompt generation complete');
        }
      });

      return result;
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
