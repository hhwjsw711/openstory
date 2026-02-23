import {
  describe,
  expect,
  it,
  spyOn,
  mock,
  beforeEach,
  afterAll,
} from 'bun:test';
import type { TextModel } from '@/lib/ai/models';
import { callOpenRouterStream } from './openrouter-client';

// Mock environment variables
mock.module('#env', () => ({
  getEnv: () => ({
    OPENROUTER_KEY: 'test-key',
  }),
}));

describe('openrouter-client', () => {
  const originalFetch = global.fetch;

  // Reset fetch mock after each test
  beforeEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('callOpenRouterStream', () => {
    it('handles split chunks correctly', async () => {
      // Create a stream that simulates split chunks
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          // Chunk 1: Complete message
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
            )
          );

          // Chunk 2: Start of message (split)
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" "')
          );

          // Chunk 3: End of message (split)
          controller.enqueue(encoder.encode('}}]}\n\n'));

          // Chunk 4: Another complete message
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"World"}}]}\n\n'
            )
          );

          // Chunk 5: Done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          controller.close();
        },
      });

      // Mock fetch using spyOn as requested
      spyOn(global, 'fetch').mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );

      const generator = callOpenRouterStream({
        model: 'test-model' as TextModel,
        messages: [{ role: 'user', content: 'test' }],
      });

      let fullText = '';
      const chunks = [];

      for await (const chunk of generator) {
        if (!chunk.done) {
          fullText = chunk.accumulated;
          chunks.push(chunk.delta);
        }
      }

      expect(fullText).toBe('Hello World');
      expect(chunks).toEqual(['Hello', ' ', 'World']);
    });

    it('handles multiple lines in a single chunk', async () => {
      // Create a stream that simulates multiple messages in one chunk
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          // Multiple messages in one chunk
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"A"}}]}\n\n' +
                'data: {"choices":[{"delta":{"content":"B"}}]}\n\n'
            )
          );

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          controller.close();
        },
      });

      spyOn(global, 'fetch').mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );

      const generator = callOpenRouterStream({
        model: 'test-model' as TextModel,
        messages: [{ role: 'user', content: 'test' }],
      });

      let fullText = '';
      const chunks = [];

      for await (const chunk of generator) {
        if (!chunk.done) {
          fullText = chunk.accumulated;
          chunks.push(chunk.delta);
        }
      }

      expect(fullText).toBe('AB');
      expect(chunks).toEqual(['A', 'B']);
    });
  });
});
