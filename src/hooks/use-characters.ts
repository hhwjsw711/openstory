import type {
  LibraryCharacter,
  LibraryCharacterWithSheets,
  CharacterSheet,
} from '@/lib/db/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCharactersFn,
  getCharacterFn,
  createCharacterFn,
  updateCharacterFn,
  deleteCharacterFn,
  toggleCharacterFavoriteFn,
  createCharacterSheetFn,
  deleteCharacterSheetFn,
} from '@/functions/characters';

// Local hook input types
type CreateCharacterInput = {
  name: string;
  description?: string;
  isFavorite?: boolean;
  isHumanGenerated?: boolean;
};

type UpdateCharacterInput = {
  name?: string;
  description?: string;
  isFavorite?: boolean;
  isHumanGenerated?: boolean;
};

type ListCharactersFilter = {
  favoritesOnly?: boolean;
  sequenceId?: string;
};

// Query keys
export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (filters?: ListCharactersFilter) =>
    [...characterKeys.lists(), filters] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (id: string) => [...characterKeys.details(), id] as const,
};

/**
 * Hook for listing characters
 * Optionally filter by favorites or sequence usage
 */
export function useCharacters(filters?: ListCharactersFilter, enabled = true) {
  return useQuery<LibraryCharacterWithSheets[]>({
    queryKey: characterKeys.list(filters),
    queryFn: async () => {
      const data = await getCharactersFn({ data: filters });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

/**
 * Hook for getting a single character with all sheets and media
 */
export function useCharacter(id: string, enabled = true) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: async () => {
      const data = await getCharacterFn({ data: { characterId: id } });
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !!id,
  });
}

/**
 * Hook for creating a character
 */
export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation<LibraryCharacter, Error, CreateCharacterInput>({
    mutationFn: async (input) => {
      const data = await createCharacterFn({ data: input });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

/**
 * Hook for updating a character
 */
export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation<
    LibraryCharacter,
    Error,
    { id: string; input: UpdateCharacterInput }
  >({
    mutationFn: async ({ id, input }) => {
      const data = await updateCharacterFn({
        data: { characterId: id, ...input },
      });
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        // Update detail cache
        queryClient.setQueryData(
          characterKeys.detail(data.id),
          (old: unknown) => (old ? { ...(old as object), ...data } : data)
        );
      }
      await queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a character
 */
export function useDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await deleteCharacterFn({ data: { characterId: id } });
    },
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: characterKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

/**
 * Hook for toggling character favorite status
 */
export function useToggleCharacterFavorite() {
  const queryClient = useQueryClient();

  return useMutation<LibraryCharacter, Error, string>({
    mutationFn: async (id) => {
      const data = await toggleCharacterFavoriteFn({
        data: { characterId: id },
      });
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        // Update detail cache with new favorite status
        queryClient.setQueryData(
          characterKeys.detail(data.id),
          (old: unknown) =>
            old ? { ...(old as object), isFavorite: data.isFavorite } : data
        );
      }
      await queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

/**
 * Hook for creating a character sheet
 */
export function useCreateCharacterSheet() {
  const queryClient = useQueryClient();

  return useMutation<
    CharacterSheet,
    Error,
    {
      characterId: string;
      name: string;
      imageUrl?: string;
      imagePath?: string;
      isDefault?: boolean;
      source?: 'script_analysis' | 'manual_upload' | 'ai_generated';
    }
  >({
    mutationFn: async (input) => {
      const data = await createCharacterSheetFn({ data: input });
      return data;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: characterKeys.detail(variables.characterId),
      });
    },
  });
}

/**
 * Hook for deleting a character sheet
 */
export function useDeleteCharacterSheet() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { sheetId: string; characterId: string }>({
    mutationFn: async ({ sheetId }) => {
      await deleteCharacterSheetFn({ data: { sheetId } });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: characterKeys.detail(variables.characterId),
      });
    },
  });
}
