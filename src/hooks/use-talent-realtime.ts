import { useRealtime } from '@/lib/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { talentKeys } from './use-talent';

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
    (event: { event: string; data: Record<string, unknown> }) => {
      const { event: eventName, data } = event;

      if (eventName !== 'talent.sheet:progress') return;
      if (typeof data.talentId !== 'string' || data.talentId !== talentId)
        return;

      const eventTalentId = data.talentId;

      if (data.status === 'generating') {
        setIsGenerating(true);
        setError(null);
      } else if (data.status === 'completed') {
        setIsGenerating(false);
        setError(null);
        void queryClient.invalidateQueries({
          queryKey: talentKeys.detail(eventTalentId),
        });
        void queryClient.invalidateQueries({
          queryKey: talentKeys.lists(),
        });
      } else if (data.status === 'failed') {
        setIsGenerating(false);
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Sheet generation failed'
        );
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
