/**
 * Hook for fetching sequence locations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFrameIdsForLocationFn,
  getSequenceLocationsFn,
  recastLocationFn,
} from '@/functions/sequence-locations';
import type { Location } from '@/lib/db/schema';

// Re-export Location as SequenceLocation for consistency with characters
export type SequenceLocation = Location;

export const sequenceLocationKeys = {
  all: ['sequence-locations'] as const,
  list: (sequenceId: string) =>
    [...sequenceLocationKeys.all, 'list', sequenceId] as const,
  framesForLocation: (sequenceId: string, locationId: string) =>
    [...sequenceLocationKeys.all, 'frames', sequenceId, locationId] as const,
};

export function useSequenceLocations(sequenceId: string) {
  return useQuery<Location[]>({
    queryKey: sequenceLocationKeys.list(sequenceId),
    queryFn: async () => {
      return getSequenceLocationsFn({ data: { sequenceId } });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - locations don't change often
    enabled: !!sequenceId,
  });
}

/**
 * Hook to get the count of frames at a location
 * Used to show affected frames before recasting
 */
export function useFrameIdsForLocation(sequenceId: string, locationId: string) {
  return useQuery({
    queryKey: sequenceLocationKeys.framesForLocation(sequenceId, locationId),
    queryFn: () =>
      getFrameIdsForLocationFn({ data: { sequenceId, locationId } }),
    enabled: !!sequenceId && !!locationId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for recasting a location with a library location reference
 */
export function useRecastLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      locationId: string;
      libraryLocationId: string;
      referenceImageUrl: string;
      description?: string;
    }) => recastLocationFn({ data }),
    onSuccess: () => {
      // Invalidate sequence locations to refresh the list
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.all,
      });
      // Invalidate frames that are at this location
      void queryClient.invalidateQueries({ queryKey: ['frames'] });
    },
  });
}
