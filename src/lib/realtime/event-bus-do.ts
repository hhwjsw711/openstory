import { DurableObject } from 'cloudflare:workers';

type Connection = {
  controller: ReadableStreamDefaultController;
  events: string[];
  eventId: number;
};

export class RealtimeChannelDO extends DurableObject {
  private connections = new Map<string, Connection>();

  async broadcast(event: string, data: Record<string, unknown>): Promise<void> {
    const encoder = new TextEncoder();
    const dead: string[] = [];

    for (const [id, conn] of this.connections) {
      if (conn.events.length > 0 && !conn.events.includes(event)) continue;
      conn.eventId++;
      try {
        conn.controller.enqueue(
          encoder.encode(
            `id: ${conn.eventId}\nevent: message\ndata: ${JSON.stringify({ event, data })}\n\n`
          )
        );
      } catch {
        dead.push(id);
      }
    }

    for (const id of dead) this.connections.delete(id);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const events =
      url.searchParams.get('events')?.split(',').filter(Boolean) ?? [];
    const id = crypto.randomUUID();

    const stream = new ReadableStream({
      start: (controller) => {
        this.connections.set(id, { controller, events, eventId: 0 });
        controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      },
      cancel: () => {
        this.connections.delete(id);
      },
    });

    request.signal.addEventListener('abort', () => {
      const conn = this.connections.get(id);
      this.connections.delete(id);
      try {
        conn?.controller.close();
      } catch {
        // Already closed
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
}
