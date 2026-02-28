import { useRealtime } from '@/lib/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { talentKeys } from './use-talent';

/**
 * Hook for subscribing to real-time talent sheet generation events for multiple talent.
 * Tracks generating status for all provided talent IDs.
 *
 * @param talentIds - Array of talent IDs to subscribe to
 * @returns Map of talentId -> generating status
 */
export function useTalentSheetsRealtime(talentIds: string[] = []) {
  const queryClient = useQueryClient();
  const [generatingStatus, setGeneratingStatus] = useState<
    Map<string, boolean>
  >(new Map());

  // Build channels array: ['talent:id1', 'talent:id2', ...]
  const channels = useMemo(
    () => talentIds.map((id) => `talent:${id}`),
    [talentIds]
  );

  const handleEvent = useCallback(
    (event: { event: string; data: Record<string, unknown> }) => {
      const { event: eventName, data } = event;

      if (eventName !== 'talent.sheet:progress') return;
      if (typeof data.talentId !== 'string') return;
      if (!talentIds.includes(data.talentId)) return;

      const eventTalentId = data.talentId;

      if (data.status === 'generating') {
        setGeneratingStatus((prev) => {
          const next = new Map(prev);
          next.set(eventTalentId, true);
          return next;
        });
      } else if (data.status === 'completed') {
        setGeneratingStatus((prev) => {
          const next = new Map(prev);
          next.delete(eventTalentId);
          return next;
        });
        void queryClient.invalidateQueries({
          queryKey: talentKeys.detail(eventTalentId),
        });
        void queryClient.invalidateQueries({
          queryKey: talentKeys.lists(),
        });
      } else if (data.status === 'failed') {
        setGeneratingStatus((prev) => {
          const next = new Map(prev);
          next.delete(eventTalentId);
          return next;
        });
      }
    },
    [talentIds, queryClient]
  );

  const { status } = useRealtime({
    channels,
    events: ['talent.sheet:progress'] as const,
    onData: handleEvent,
    enabled: talentIds.length > 0,
  });

  // Helper to check if a specific talent is generating
  const isGenerating = useCallback(
    (talentId: string) => generatingStatus.get(talentId) ?? false,
    [generatingStatus]
  );

  return {
    isGenerating,
    connectionStatus: status,
  };
}
