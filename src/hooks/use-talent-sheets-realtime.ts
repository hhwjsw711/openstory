import { useRealtime } from '@/lib/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { talentKeys } from './use-talent';

type SheetProgressEvent = {
  event: string;
  data: {
    talentId: string;
    status: 'generating' | 'completed' | 'failed';
    sheetId?: string;
    sheetImageUrl?: string;
    headshotImageUrl?: string;
    error?: string;
  };
};

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
    (event: SheetProgressEvent) => {
      const { event: eventName, data } = event;

      if (eventName !== 'talent.sheet:progress') return;
      if (!talentIds.includes(data.talentId)) return;

      switch (data.status) {
        case 'generating':
          setGeneratingStatus((prev) => {
            const next = new Map(prev);
            next.set(data.talentId, true);
            return next;
          });
          break;

        case 'completed':
          setGeneratingStatus((prev) => {
            const next = new Map(prev);
            next.delete(data.talentId);
            return next;
          });
          // Invalidate queries to refresh sheets and headshot
          void queryClient.invalidateQueries({
            queryKey: talentKeys.detail(data.talentId),
          });
          // Also invalidate list to show new headshot in talent grid
          void queryClient.invalidateQueries({
            queryKey: talentKeys.lists(),
          });
          break;

        case 'failed':
          setGeneratingStatus((prev) => {
            const next = new Map(prev);
            next.delete(data.talentId);
            return next;
          });
          break;
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
