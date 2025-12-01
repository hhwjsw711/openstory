/**
 * Server-Sent Events (SSE) streaming utilities
 * Creates ReadableStreams for streaming progress back to clients
 */

export type SSEEmitter = {
  /** Emit a progress event */
  progress: (progress: number, total?: number, message?: string) => void;
  /** Emit a text chunk from LLM streaming */
  chunk: (phase: number, phaseName: string, text: string) => void;
  /** Emit a custom named event with data */
  data: (eventName: string, data: unknown) => void;
  /** Emit a comment (for keepalive) */
  comment: (text: string) => void;
};

/**
 * Create a ReadableStream for Server-Sent Events
 *
 * @param generator - Async function that receives an emitter and returns the final result
 * @returns ReadableStream that emits SSE-formatted events
 *
 * @example
 * ```typescript
 * const stream = createSSEStream(async (emit) => {
 *   emit.progress(0, 100, 'Starting...');
 *   const result = await doWork();
 *   emit.progress(100, 100, 'Done!');
 *   return result;
 * });
 *
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/event-stream' }
 * });
 * ```
 */
export function createSSEStream<T>(
  generator: (emit: SSEEmitter) => Promise<T>
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const emit: SSEEmitter = {
        progress: (progress: number, total?: number, message?: string) => {
          const data = JSON.stringify({ progress, total, message });
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${data}\n\n`)
          );
        },

        chunk: (phase: number, phaseName: string, text: string) => {
          const data = JSON.stringify({ phase, phaseName, text });
          controller.enqueue(encoder.encode(`event: chunk\ndata: ${data}\n\n`));
        },

        data: (eventName: string, data: unknown) => {
          const payload = JSON.stringify(data);
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${payload}\n\n`)
          );
        },

        comment: (text: string) => {
          controller.enqueue(encoder.encode(`: ${text}\n\n`));
        },
      };

      try {
        const result = await generator(emit);

        // Send final result
        emit.data('result', result);

        // Close stream
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        emit.data('error', { error: message });
        controller.close();
      }
    },
  });
}

/**
 * Standard SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
} as const;
