/**
 * Upstash Redis event bus for non-Cloudflare production deployments (Vercel, Railway).
 *
 * Uses Redis Streams (XADD/XREAD) via the @upstash/redis REST client.
 * - emit() appends to a stream (fire-and-forget)
 * - handleSSE() polls XREAD and formats output identically to CF/local buses
 */

import { Redis } from '@upstash/redis';
import { getEnv } from '#env';

const POLL_INTERVAL_MS = 300;
const STREAM_PREFIX = 'realtime:';
const STREAM_MAX_LEN = 1000;

type StreamFields = { e: string; d: string };

function isStreamFields(v: unknown): v is StreamFields {
  if (typeof v !== 'object' || v === null || !('e' in v) || !('d' in v))
    return false;
  return typeof v.e === 'string' && typeof v.d === 'string';
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const env = getEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for realtime features on non-Cloudflare deployments'
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

class UpstashEventBus {
  emit(channel: string, event: string, data: Record<string, unknown>): void {
    // Fire-and-forget: append to Redis Stream with approximate trimming
    void getRedis().xadd(
      `${STREAM_PREFIX}${channel}`,
      '*',
      { e: event, d: JSON.stringify(data) },
      { trim: { type: 'MAXLEN', comparison: '~', threshold: STREAM_MAX_LEN } }
    );
  }

  async handleSSE(
    request: Request,
    channels: string[],
    events: string[]
  ): Promise<Response> {
    const client = getRedis();
    const encoder = new TextEncoder();
    let eventId = 0;

    const streamKeys = channels.map((ch) => `${STREAM_PREFIX}${ch}`);

    // Start from current timestamp — only receive messages published after connection
    const startId = `${Date.now()}-0`;
    const lastIds: Record<string, string> = {};
    for (const key of streamKeys) {
      lastIds[key] = startId;
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`: connected\n\n`));

        let aborted = false;
        request.signal.addEventListener('abort', () => {
          aborted = true;
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });

        const poll = async () => {
          while (!aborted) {
            try {
              const results = await client.xread(
                streamKeys,
                streamKeys.map((k) => lastIds[k]),
                { count: 100 }
              );

              if (results) {
                for (const result of results) {
                  if (!Array.isArray(result) || result.length < 2) continue;
                  const streamName = String(result[0]);
                  const messages = result[1];
                  if (!Array.isArray(messages)) continue;

                  for (const msg of messages) {
                    if (!Array.isArray(msg) || msg.length < 2) continue;
                    const id = String(msg[0]);
                    const fields = msg[1];
                    if (!isStreamFields(fields)) continue;

                    lastIds[streamName] = id;
                    const eventName = fields.e;
                    if (events.length > 0 && !events.includes(eventName))
                      continue;

                    eventId++;
                    const parsed = JSON.parse(fields.d);
                    const sseMsg = `id: ${eventId}\nevent: message\ndata: ${JSON.stringify({ event: eventName, data: parsed })}\n\n`;
                    try {
                      controller.enqueue(encoder.encode(sseMsg));
                    } catch {
                      return; // Stream closed by client
                    }
                  }
                }
              }
            } catch {
              // Redis error — continue polling
            }

            if (!aborted) {
              await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
            }
          }
        };

        poll().catch(() => {
          /* noop — stream closed */
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
}

let bus: UpstashEventBus | null = null;

export function getEventBus(): UpstashEventBus {
  if (!bus) bus = new UpstashEventBus();
  return bus;
}
