import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Style } from '@/types/database';

export interface CreateStyleInput {
  name: string;
  description?: string;
  config?: unknown;
  category?: string;
  tags?: string[];
  is_public?: boolean;
  preview_url?: string | null;
}

// Query keys
export const styleKeys = {
  all: ['styles'] as const,
  lists: () => [...styleKeys.all, 'list'] as const,
  list: (teamId?: string) => [...styleKeys.lists(), teamId] as const,
  details: () => [...styleKeys.all, 'detail'] as const,
  detail: (id: string) => [...styleKeys.details(), id] as const,
};

// Hook for listing styles
export function useStyles(teamId?: string, enabled = true) {
  return useQuery<Style[]>({
    queryKey: styleKeys.list(teamId),
    queryFn: async () => {
      const response = await fetch('/api/styles');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to list styles');
      }

      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (styles change less frequently)
    enabled,
  });
}

// Hook for getting single style
export function useStyle(id: string) {
  return useQuery<Style>({
    queryKey: styleKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/styles/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to get style');
      }

      return result.data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!id,
  });
}

// Hook for creating style
export function useCreateStyle() {
  const queryClient = useQueryClient();

  return useMutation<Style, Error, CreateStyleInput>({
    mutationFn: async (input: CreateStyleInput) => {
      const response = await fetch('/api/styles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create style');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
  });
}

// Hook for updating style
export function useUpdateStyle() {
  const queryClient = useQueryClient();

  return useMutation<
    Style,
    Error,
    {
      id: string;
      input: Partial<CreateStyleInput>;
    }
  >({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreateStyleInput>;
    }) => {
      const response = await fetch(`/api/styles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update style');
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.setQueryData(styleKeys.detail(data.id), data);
      }
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
  });
}

// Hook for deleting style
export function useDeleteStyle() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/styles/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete style');
      }
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: styleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
  });
}
