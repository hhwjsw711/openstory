import { createFileRoute } from '@tanstack/react-router';
import { getEventBus } from '@/lib/realtime/event-bus';

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
        let eventId = 0;

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            // Send SSE comment as connection confirmation
            controller.enqueue(encoder.encode(`: connected\n\n`));

            // Subscribe to all requested channels
            const unsubscribers = channels.map((channel) =>
              bus.subscribe(channel, (eventName, data) => {
                // Filter by requested events if specified
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

            // Clean up subscriptions when client disconnects
            request.signal.addEventListener('abort', () => {
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
      },
    },
  },
});
