import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTalentFn,
  deleteTalentFn,
  generateTalentSheetFn,
  getTalentByIdFn,
  getTalentFn,
  setDefaultSheetFn,
  toggleTalentFavoriteFn,
  updateTalentFn,
  uploadTalentMediaFn,
  uploadTempMediaFn,
  deleteTalentMediaFn,
} from '@/functions/talent';
import type {
  CreateTalentInput,
  UpdateTalentInput,
} from '@/lib/schemas/talent.schemas';

/**
 * Query keys for talent data
 */
export const talentKeys = {
  all: ['talent'] as const,
  lists: () => [...talentKeys.all, 'list'] as const,
  list: (filters: { favoritesOnly?: boolean }) =>
    [...talentKeys.lists(), filters] as const,
  details: () => [...talentKeys.all, 'detail'] as const,
  detail: (id: string) => [...talentKeys.details(), id] as const,
};

/**
 * Hook to fetch all talent for the current team
 */
export function useTalent(options?: { favoritesOnly?: boolean }) {
  return useQuery({
    queryKey: talentKeys.list(options ?? {}),
    queryFn: () => getTalentFn({ data: options }),
  });
}

/**
 * Hook to fetch a single talent with all relations
 */
export function useTalentById(talentId: string) {
  return useQuery({
    queryKey: talentKeys.detail(talentId),
    queryFn: () => getTalentByIdFn({ data: { talentId } }),
    enabled: !!talentId,
  });
}

/**
 * Hook to create new talent
 */
export function useCreateTalent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTalentInput) => createTalentFn({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: talentKeys.lists() });
    },
  });
}

/**
 * Hook to update talent
 */
export function useUpdateTalent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTalentInput & { talentId: string }) =>
      updateTalentFn({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(variables.talentId),
      });
      void queryClient.invalidateQueries({ queryKey: talentKeys.lists() });
    },
  });
}

/**
 * Hook to delete talent
 */
export function useDeleteTalent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (talentId: string) => deleteTalentFn({ data: { talentId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: talentKeys.lists() });
    },
  });
}

/**
 * Hook to toggle talent favorite status
 */
export function useToggleTalentFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (talentId: string) =>
      toggleTalentFavoriteFn({ data: { talentId } }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(data.id),
      });
      void queryClient.invalidateQueries({ queryKey: talentKeys.lists() });
    },
  });
}

/**
 * Hook to upload talent media
 */
export function useUploadTalentMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      talentId: string;
      type: 'image' | 'video' | 'recording';
      base64Data: string;
      filename: string;
    }) => uploadTalentMediaFn({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(variables.talentId),
      });
    },
  });
}

/**
 * Hook to upload media to temporary storage (before talent creation)
 */
export function useUploadTempMedia() {
  return useMutation({
    mutationFn: (data: {
      base64Data: string;
      filename: string;
      type: 'image' | 'video';
    }) => uploadTempMediaFn({ data }),
  });
}

/**
 * Hook to delete talent media
 */
export function useDeleteTalentMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { mediaId: string; talentId: string }) =>
      deleteTalentMediaFn({ data: { mediaId: data.mediaId } }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(variables.talentId),
      });
    },
  });
}

/**
 * Hook to generate a talent sheet from reference media
 */
export function useGenerateTalentSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { talentId: string; sheetName?: string }) =>
      generateTalentSheetFn({ data }),
    onSuccess: (_, variables) => {
      // Optimistically update the query - the realtime hook will handle the actual update
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(variables.talentId),
      });
    },
  });
}

/**
 * Hook to set a talent sheet as the default
 */
export function useSetDefaultSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { sheetId: string; talentId: string }) =>
      setDefaultSheetFn({ data: { sheetId: data.sheetId } }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: talentKeys.detail(variables.talentId),
      });
      void queryClient.invalidateQueries({ queryKey: talentKeys.lists() });
    },
  });
}
