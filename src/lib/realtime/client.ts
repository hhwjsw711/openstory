import { useEffect, useRef, useState } from 'react';

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type UseRealtimeOptions = {
  channels: string[];
  events: readonly string[];
  onData: (event: { event: string; data: Record<string, unknown> }) => void;
  enabled?: boolean;
};

/**
 * Hook for subscribing to real-time events via Server-Sent Events (SSE).
 *
 * Connects to /api/realtime with the specified channels and events as query params.
 * EventSource provides automatic reconnection on disconnect.
 */
export function useRealtime({
  channels,
  events,
  onData,
  enabled = true,
}: UseRealtimeOptions): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  // Stable key for channels and events to avoid unnecessary reconnections
  const channelsKey = channels.join(',');
  const eventsKey = events.join(',');

  useEffect(() => {
    if (!enabled || channels.length === 0) {
      setStatus('disconnected');
      return;
    }

    const params = new URLSearchParams();
    params.set('channels', channelsKey);
    params.set('events', eventsKey);

    const eventSource = new EventSource(`/api/realtime?${params}`);
    setStatus('connecting');

    eventSource.onopen = () => setStatus('connected');

    eventSource.addEventListener('message', (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onDataRef.current(parsed);
      } catch {
        // Malformed event data — skip
      }
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects by default (~3s).
      // Set status for UI fallback (hybrid polling in scenes-view.tsx).
      setStatus('error');
    };

    return () => {
      eventSource.close();
      setStatus('disconnected');
    };
  }, [enabled, channelsKey, eventsKey]);

  return { status };
}
