import { useRealtime } from '@/lib/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
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
 * Hook for subscribing to real-time talent sheet generation events.
 *
 * @param talentId - The talent ID to subscribe to
 * @returns Generation status and any error message
 */
export function useTalentSheetRealtime(talentId?: string) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvent = useCallback(
    (event: SheetProgressEvent) => {
      const { event: eventName, data } = event;

      if (eventName !== 'talent.sheet:progress') return;
      if (data.talentId !== talentId) return;

      switch (data.status) {
        case 'generating':
          setIsGenerating(true);
          setError(null);
          break;

        case 'completed':
          setIsGenerating(false);
          setError(null);
          // Invalidate talent queries to refresh sheets and headshot
          void queryClient.invalidateQueries({
            queryKey: talentKeys.detail(data.talentId),
          });
          // Also invalidate list to show new headshot in talent grid
          void queryClient.invalidateQueries({
            queryKey: talentKeys.lists(),
          });
          break;

        case 'failed':
          setIsGenerating(false);
          setError(data.error ?? 'Sheet generation failed');
          break;
      }
    },
    [talentId, queryClient]
  );

  const { status } = useRealtime({
    channels: talentId ? [`talent:${talentId}`] : [],
    events: ['talent.sheet:progress'] as const,
    onData: handleEvent,
    enabled: !!talentId,
  });

  // Allow starting generation optimistically (before realtime event arrives)
  const startGenerating = useCallback(() => {
    setIsGenerating(true);
    setError(null);
  }, []);

  return {
    isGenerating,
    error,
    connectionStatus: status,
    startGenerating,
  };
}
