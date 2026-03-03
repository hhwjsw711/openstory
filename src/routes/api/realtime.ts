import { createFileRoute } from '@tanstack/react-router';
import { getEventBus } from '#realtime-bus';

export const Route = createFileRoute('/api/realtime')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const channels =
          url.searchParams.get('channels')?.split(',').filter(Boolean) ?? [];
        const events =
          url.searchParams.get('events')?.split(',').filter(Boolean) ?? [];

        const bus = getEventBus();

        // Cloudflare: proxy DO streams
        if (isCloudfareBus(bus)) {
          return handleCloudflareSSE(bus, channels, events, request.signal);
        }

        // Upstash: Redis Streams polling
        if (isUpstashBus(bus)) {
          return bus.handleSSE(request, channels, events);
        }

        // Local: in-memory subscribe
        return handleLocalSSE(bus, channels, events, request.signal);
      },
    },
  },
});

type LocalBus = {
  subscribe: (
    ch: string,
    cb: (event: string, data: Record<string, unknown>) => void
  ) => () => void;
};

type CloudflareBus = {
  getSSEStream: (ch: string, ev: string[]) => Promise<Response>;
};

type UpstashBus = {
  handleSSE: (
    req: Request,
    channels: string[],
    events: string[]
  ) => Promise<Response>;
};

function isCloudfareBus(bus: unknown): bus is CloudflareBus {
  return typeof bus === 'object' && bus !== null && 'getSSEStream' in bus;
}

function isUpstashBus(bus: unknown): bus is UpstashBus {
  return typeof bus === 'object' && bus !== null && 'handleSSE' in bus;
}

function handleLocalSSE(
  bus: LocalBus,
  channels: string[],
  events: string[],
  signal: AbortSignal
): Response {
  let eventId = 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const unsubscribers = channels.map((channel) =>
        bus.subscribe(channel, (eventName, data) => {
          if (events.length > 0 && !events.includes(eventName)) return;

          eventId++;
          const msg = `id: ${eventId}\nevent: message\ndata: ${JSON.stringify({ event: eventName, data })}\n\n`;
          try {
            controller.enqueue(encoder.encode(msg));
          } catch {
            // Stream closed by client
          }
        })
      );

      signal.addEventListener('abort', () => {
        unsubscribers.forEach((unsub) => unsub());
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function handleCloudflareSSE(
  bus: CloudflareBus,
  channels: string[],
  events: string[],
  signal: AbortSignal
): Promise<Response> {
  // Single channel: proxy the DO stream directly
  if (channels.length === 1) {
    return bus.getSSEStream(channels[0], events);
  }

  // Multi-channel: merge DO streams into one SSE response
  const doResponses = await Promise.all(
    channels.map((ch) => bus.getSSEStream(ch, events))
  );

  let eventId = 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
      for (const r of doResponses) {
        if (r.body) readers.push(r.body.getReader());
      }

      const pump = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Re-stamp event IDs for the merged stream
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          const rewritten = lines
            .map((line) => {
              if (line.startsWith('id: ')) {
                eventId++;
                return `id: ${eventId}`;
              }
              return line;
            })
            .join('\n');

          try {
            controller.enqueue(encoder.encode(rewritten));
          } catch {
            break;
          }
        }
      };

      // Read all DO streams concurrently
      await Promise.allSettled(readers.map(pump));

      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });

  signal.addEventListener('abort', () => {
    for (const r of doResponses) {
      void r.body?.cancel();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
