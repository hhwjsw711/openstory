'use client';

import { useRealtime } from '@/lib/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { characterKeys } from './use-characters';

type SheetProgressEvent = {
  event: string;
  data: {
    characterId: string;
    status: 'generating' | 'completed' | 'failed';
    sheetId?: string;
    sheetImageUrl?: string;
    headshotImageUrl?: string;
    error?: string;
  };
};

/**
 * Hook for subscribing to real-time character sheet generation events.
 *
 * @param characterId - The character ID to subscribe to
 * @returns Generation status and any error message
 */
export function useCharacterSheetRealtime(characterId?: string) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvent = useCallback(
    (event: SheetProgressEvent) => {
      const { event: eventName, data } = event;

      if (eventName !== 'character.sheet:progress') return;
      if (data.characterId !== characterId) return;

      switch (data.status) {
        case 'generating':
          setIsGenerating(true);
          setError(null);
          break;

        case 'completed':
          setIsGenerating(false);
          setError(null);
          // Invalidate character queries to refresh sheets and headshot
          void queryClient.invalidateQueries({
            queryKey: characterKeys.detail(data.characterId),
          });
          // Also invalidate list to show new headshot in character grid
          void queryClient.invalidateQueries({
            queryKey: characterKeys.lists(),
          });
          break;

        case 'failed':
          setIsGenerating(false);
          setError(data.error ?? 'Sheet generation failed');
          break;
      }
    },
    [characterId, queryClient]
  );

  const { status } = useRealtime({
    channels: characterId ? [`character:${characterId}`] : [],
    events: ['character.sheet:progress'] as const,
    onData: handleEvent,
    enabled: !!characterId,
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
