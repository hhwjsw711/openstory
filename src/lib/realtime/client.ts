import { useEffect, useRef, useState } from 'react';
import { usePartySocket } from 'partysocket/react';
import PartySocket from 'partysocket';
import { usePartyKitHost } from './party-provider';

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

type RealtimeMessage = { event: string; data: unknown };

type UseRealtimeOptions = {
  channels: string[];
  events: readonly string[];
  onData: (event: RealtimeMessage) => void;
  enabled?: boolean;
};

function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    'event' in value &&
    typeof value.event === 'string'
  );
}

function parseMessage(raw: unknown): RealtimeMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRealtimeMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Hook for subscribing to real-time events via PartyKit WebSockets.
 * Drop-in replacement for the previous @upstash/realtime useRealtime hook.
 */
export function useRealtime({
  channels,
  events,
  onData,
  enabled = true,
}: UseRealtimeOptions): { status: RealtimeStatus } {
  // Multi-channel needs a separate implementation
  if (channels.length > 1) {
    return useMultiChannelRealtime({ channels, events, onData, enabled });
  }

  return useSingleChannelRealtime({
    room: channels[0],
    events,
    onData,
    enabled: enabled && channels.length === 1,
  });
}

// --- Single channel (most common case) ---

function useSingleChannelRealtime({
  room,
  events,
  onData,
  enabled,
}: {
  room: string | undefined;
  events: readonly string[];
  onData: UseRealtimeOptions['onData'];
  enabled: boolean;
}): { status: RealtimeStatus } {
  const host = usePartyKitHost();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  // Keep stable refs so the socket handlers don't cause reconnects
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  usePartySocket({
    host,
    room: room ?? '__disabled__',
    enabled: enabled && !!room,
    onOpen() {
      setStatus('connected');
    },
    onClose() {
      setStatus('disconnected');
    },
    onError() {
      setStatus('disconnected');
    },
    onMessage(evt) {
      const msg = parseMessage(evt.data);
      if (msg && eventsRef.current.includes(msg.event)) {
        onDataRef.current(msg);
      }
    },
  });

  return { status };
}

// --- Multi-channel (talent sheets) ---

function useMultiChannelRealtime({
  channels,
  events,
  onData,
  enabled,
}: UseRealtimeOptions): { status: RealtimeStatus } {
  const host = usePartyKitHost();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Stable channel key for dependency tracking
  const channelsKey = channels.join(',');

  useEffect(() => {
    if (!enabled || channels.length === 0) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    let connectedCount = 0;
    const totalCount = channels.length;

    const sockets = channels.map((room) => {
      const socket = new PartySocket({ host, room });

      socket.addEventListener('open', () => {
        connectedCount++;
        if (connectedCount === totalCount) {
          setStatus('connected');
        }
      });

      socket.addEventListener('close', () => {
        connectedCount = Math.max(0, connectedCount - 1);
        if (connectedCount === 0) {
          setStatus('disconnected');
        }
      });

      socket.addEventListener('message', (evt) => {
        const msg = parseMessage(evt.data);
        if (msg && eventsRef.current.includes(msg.event)) {
          onDataRef.current(msg);
        }
      });

      return socket;
    });

    return () => {
      for (const socket of sockets) {
        socket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, channelsKey, enabled]);

  return { status };
}
