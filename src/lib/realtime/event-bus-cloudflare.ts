import { env } from 'cloudflare:workers';
import type { RealtimeChannelDO } from './event-bus-do';

function getRealtimeBinding() {
  const binding = env.REALTIME;
  if (!binding)
    throw new Error('REALTIME Durable Object binding not configured');
  return binding;
}

class CloudflareEventBus {
  private getStub(channel: string): DurableObjectStub<RealtimeChannelDO> {
    const binding = getRealtimeBinding();
    const id = binding.idFromName(channel);
    return binding.get(id);
  }

  emit(channel: string, event: string, data: Record<string, unknown>): void {
    void this.getStub(channel).broadcast(event, data);
  }

  async getSSEStream(channel: string, events: string[]): Promise<Response> {
    const params = new URLSearchParams();
    if (events.length > 0) params.set('events', events.join(','));
    return this.getStub(channel).fetch(`https://do-internal/?${params}`);
  }
}

let bus: CloudflareEventBus | null = null;

export function getEventBus(): CloudflareEventBus {
  if (!bus) bus = new CloudflareEventBus();
  return bus;
}
