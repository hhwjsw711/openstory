import type { Style } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getStylesFn,
  getStyleFn,
  createStyleFn,
  updateStyleFn,
  deleteStyleFn,
} from '@/functions/styles';

// Local hook input types (simpler than server schema types)
export type CreateStyleInput = {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  previewUrl?: string | null;
};

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
      const data = await getStylesFn();
      return data as Style[];
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
      const data = await getStyleFn({ data: { styleId: id } });
      return data as Style;
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
      const data = await createStyleFn({
        data: input as Parameters<typeof createStyleFn>[0]['data'],
      });
      return data as Style;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
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
      const data = await updateStyleFn({
        data: {
          styleId: id,
          ...input,
        } as Parameters<typeof updateStyleFn>[0]['data'],
      });
      return data as Style;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        queryClient.setQueryData(styleKeys.detail(data.id), data);
      }
      await queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
  });
}

// Hook for deleting style
export function useDeleteStyle() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await deleteStyleFn({ data: { styleId: id } });
    },
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: styleKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
  });
}
