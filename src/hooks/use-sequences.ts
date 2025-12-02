import { DEFAULT_ANALYSIS_MODEL } from '@/lib/ai/models.config';
import {
  CreateSequenceInput,
  UpdateSequenceInput,
} from '@/lib/schemas/sequence.schemas';
import type { Sequence } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query keys
export const sequenceKeys = {
  all: ['sequences'] as const,
  lists: () => [...sequenceKeys.all, 'list'] as const,
  list: (teamId?: string) => [...sequenceKeys.lists(), teamId] as const,
  details: () => [...sequenceKeys.all, 'detail'] as const,
  detail: (id?: string) => [...sequenceKeys.details(), id] as const,
};

// Hook for listing sequences
export function useSequences(teamId?: string) {
  return useQuery<Sequence[]>({
    queryKey: sequenceKeys.list(teamId),
    queryFn: async () => {
      const response = await fetch('/api/sequences');
      const result: { success: boolean; data?: Sequence[]; message?: string } =
        await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Failed to load sequences');
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for getting single sequence
export function useSequence(
  id?: string,
  options?: {
    refetchInterval?: number | false;
    staleTime?: number;
  }
) {
  return useQuery<Sequence>({
    queryKey: sequenceKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/sequences/${id}`);
      const result: { success: boolean; data?: Sequence; message?: string } =
        await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Failed to load sequence');
      }

      return result.data;
    },
    staleTime: options?.staleTime ?? 1000, // Default to 1 second for better responsiveness
    enabled: !!id,
    // If refetchInterval is explicitly passed, use it; otherwise use smart polling
    refetchInterval:
      options?.refetchInterval !== undefined
        ? options.refetchInterval
        : (query) => {
            if (!query.state.data) return false;

            const sequence = query.state.data;

            // Poll for draft sequences (may be generating frames)
            if (
              sequence?.status === 'draft' ||
              sequence?.status === 'processing'
            ) {
              return 1000; // 1 second
            }

            // Stop polling for completed/archived sequences
            return false;
          },
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

// Hook for creating sequence (supports multi-model selection)
export function useCreateSequence() {
  const queryClient = useQueryClient();

  return useMutation<
    { data: Sequence[]; message?: string },
    Error,
    CreateSequenceInput
  >({
    mutationFn: async (input) => {
      const response = await fetch('/api/sequences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: input.script,
          styleId: input.styleId,
          title: input.title || 'Untitled Sequence',
          analysisModels: input.analysisModels || [DEFAULT_ANALYSIS_MODEL],
          teamId: input.teamId,
          aspectRatio: input.aspectRatio,
          imageModel: input.imageModel,
          videoModel: input.videoModel,
          autoGenerateMotion: input.autoGenerateMotion,
        }),
      });

      const result: { success: boolean; data?: Sequence[]; message?: string } =
        await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Failed to create sequence');
      }

      return {
        data: result.data,
        message: result.message || 'Sequence created successfully',
      };
    },
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: sequenceKeys.lists() })
        .catch((error) => {
          console.error('Error invalidating sequences list on success:', error);
        });
    },
  });
}

// Hook for updating sequence
export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation<Sequence, Error, UpdateSequenceInput & { id: string }>({
    mutationFn: async (input: UpdateSequenceInput & { id: string }) => {
      const response = await fetch(`/api/sequences/${input.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result: { success: boolean; data?: Sequence; message?: string } =
        await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Failed to update sequence');
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.setQueryData(sequenceKeys.detail(data.id), data);
      }
      queryClient
        .invalidateQueries({ queryKey: sequenceKeys.lists() })
        .catch((error) => {
          console.error('Error invalidating sequences list on success:', error);
        });
    },
  });
}

// Hook for deleting sequence
export function useDeleteSequence() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sequences/${id}`, {
        method: 'DELETE',
      });

      const result: { success: boolean; message?: string } =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete sequence');
      }
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: sequenceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() });
    },
  });
}
