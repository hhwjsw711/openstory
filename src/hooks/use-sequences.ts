import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSequenceInput,
  UpdateSequenceInput,
} from "#actions/sequence";

// Import the actions (will resolve to mock in Storybook)
const actions = import("#actions/sequence");

// Query keys
export const sequenceKeys = {
  all: ["sequences"] as const,
  lists: () => [...sequenceKeys.all, "list"] as const,
  list: (teamId?: string) => [...sequenceKeys.lists(), teamId] as const,
  details: () => [...sequenceKeys.all, "detail"] as const,
  detail: (id: string) => [...sequenceKeys.details(), id] as const,
};

// Hook for listing sequences
export function useSequences(teamId?: string) {
  return useQuery({
    queryKey: sequenceKeys.list(teamId),
    queryFn: async () => {
      const { listSequences } = await actions;
      return listSequences(teamId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for getting single sequence
export function useSequence(id: string) {
  return useQuery({
    queryKey: sequenceKeys.detail(id),
    queryFn: async () => {
      const { getSequence } = await actions;
      return getSequence(id);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

// Hook for creating sequence
export function useCreateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSequenceInput) => {
      const { createSequence } = await actions;
      return createSequence(input);
    },
    onSuccess: () => {
      // Invalidate and refetch sequences list
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() });
    },
  });
}

// Hook for updating sequence
export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSequenceInput) => {
      const { updateSequence } = await actions;
      return updateSequence(input);
    },
    onSuccess: (data, _variables) => {
      // Update the specific sequence in cache
      const result = data as unknown;
      if (
        result &&
        typeof result === "object" &&
        result !== null &&
        "id" in result
      ) {
        queryClient.setQueryData(
          sequenceKeys.detail((result as any).id),
          result,
        );
      }
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() });
    },
  });
}

// Hook for deleting sequence
export function useDeleteSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteSequence } = await actions;
      return deleteSequence(id);
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: sequenceKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() });
    },
  });
}

// Hook for generating storyboard
export function useGenerateStoryboard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequenceId: string) => {
      const { generateStoryboard } = await actions;
      return generateStoryboard(sequenceId);
    },
    onSuccess: (_, sequenceId) => {
      // Invalidate the sequence to get updated status
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(sequenceId),
      });
    },
  });
}
