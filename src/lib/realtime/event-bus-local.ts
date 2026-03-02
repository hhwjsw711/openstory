/**
 * In-memory event bus replacing Redis pub/sub.
 *
 * Workflows call emit() to publish events to channels.
 * SSE connections call subscribe() to receive events.
 */

type EventCallback = (event: string, data: Record<string, unknown>) => void;

class EventBus {
  private subscribers = new Map<string, Set<EventCallback>>();

  subscribe(channel: string, callback: EventCallback): () => void {
    let subs = this.subscribers.get(channel);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(channel, subs);
    }
    subs.add(callback);

    return () => {
      this.subscribers.get(channel)?.delete(callback);
      if (this.subscribers.get(channel)?.size === 0) {
        this.subscribers.delete(channel);
      }
    };
  }

  emit(channel: string, event: string, data: Record<string, unknown>): void {
    this.subscribers.get(channel)?.forEach((cb) => {
      try {
        cb(event, data);
      } catch {
        // Connection may be closed — safe to ignore
      }
    });
  }
}

let bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!bus) bus = new EventBus();
  return bus;
}
