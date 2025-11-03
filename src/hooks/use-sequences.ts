import { UpdateSequenceInput } from '@/lib/schemas/sequence.schemas';
import type { Sequence } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query keys
export const sequenceKeys = {
  all: ['sequences'] as const,
  lists: () => [...sequenceKeys.all, 'list'] as const,
  list: (teamId?: string) => [...sequenceKeys.lists(), teamId] as const,
  details: () => [...sequenceKeys.all, 'detail'] as const,
  detail: (id: string) => [...sequenceKeys.details(), id] as const,
};

// Hook for listing sequences
export function useSequences(teamId?: string) {
  return useQuery<Sequence[]>({
    queryKey: sequenceKeys.list(teamId),
    queryFn: async () => {
      const response = await fetch('/api/sequences');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load sequences');
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for getting single sequence
export function useSequence(
  id: string,
  options?: {
    refetchInterval?: number | false;
    staleTime?: number;
  }
) {
  return useQuery<Sequence>({
    queryKey: sequenceKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/sequences/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load sequence');
      }

      return result.data;
    },
    staleTime: options?.staleTime ?? 1000, // Default to 1 second for better responsiveness
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

// Hook for creating sequence (supports multi-model selection)
export function useCreateSequence() {
  const queryClient = useQueryClient();

  return useMutation<
    { data: Sequence[]; message: string },
    Error,
    {
      script: string;
      styleId: string | null;
      title?: string;
      analysisModels?: string[];
      teamId?: string;
    }
  >({
    mutationFn: async (input: {
      script: string;
      styleId: string | null;
      title?: string;
      analysisModels?: string[];
      teamId?: string;
    }) => {
      const response = await fetch('/api/sequences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: input.script,
          styleId: input.styleId,
          title: input.title || 'Untitled Sequence',
          analysisModels: input.analysisModels || [
            'anthropic/claude-haiku-4.5',
          ],
          teamId: input.teamId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create sequence');
      }

      return { data: result.data, message: result.message };
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

      const result = await response.json();

      if (!response.ok || !result.success) {
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

      const result = await response.json();

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
