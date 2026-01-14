import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSequences } from './use-sequences';
import { frameKeys } from './use-frames';
import { getFramesFn } from '@/functions/frames';
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
    queries: (sequences || []).map((seq: Sequence) => ({
      queryKey: frameKeys.list(seq.id),
      queryFn: async (): Promise<Frame[]> => {
        const data = await getFramesFn({ data: { sequenceId: seq.id } });
        return data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !!sequences && sequences.length > 0,
    })),
  });

  // Combine sequences with their frames
  const data = useMemo<SequenceWithFrames[]>(() => {
    if (!sequences) return [];

    return sequences.map((seq: Sequence, i: number) => ({
      ...seq,
      frames: framesQueries[i]?.data ?? [],
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
