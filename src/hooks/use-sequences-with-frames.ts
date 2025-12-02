import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSequences, sequenceKeys } from './use-sequences';
import { frameKeys } from './use-frames';
import type { Sequence, Frame } from '@/types/database';

export type SequenceWithFrames = Sequence & { frames: Frame[] };

/**
 * Fetches all sequences and their frames in parallel.
 * Used for the evaluation view where we need all frames for all sequences.
 */
export function useSequencesWithFrames() {
  const {
    data: sequences,
    isLoading: seqLoading,
    error: seqError,
  } = useSequences();

  // Fetch frames for all sequences in parallel
  const framesQueries = useQueries({
    queries: (sequences || []).map((seq) => ({
      queryKey: frameKeys.list(seq.id),
      queryFn: async (): Promise<Frame[]> => {
        const response = await fetch(`/api/sequences/${seq.id}/frames`);
        const result: { success: boolean; data?: Frame[]; message?: string } =
          await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to load frames');
        }

        return result.data || [];
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !!sequences && sequences.length > 0,
    })),
  });

  // Combine sequences with their frames
  const data = useMemo<SequenceWithFrames[]>(() => {
    if (!sequences) return [];

    return sequences.map((seq, i) => ({
      ...seq,
      frames: framesQueries[i]?.data || [],
    }));
  }, [sequences, framesQueries]);

  // Loading state: sequences loading OR any frames query still loading
  const isLoading =
    seqLoading ||
    (sequences &&
      sequences.length > 0 &&
      framesQueries.some((q) => q.isLoading));

  // Error state: sequence error or first frames error
  const error = seqError || framesQueries.find((q) => q.error)?.error;

  return {
    data: isLoading ? undefined : data,
    isLoading,
    error,
  };
}
