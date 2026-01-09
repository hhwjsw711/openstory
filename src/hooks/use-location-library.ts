/**
 * Hooks for team-level location library operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addLocationSheetsFn,
  createLibraryLocationFn,
  deleteLibraryLocationFn,
  deleteLocationSheetFn,
  getLibraryLocationByIdFn,
  updateLibraryLocationFn,
  uploadLocationMediaFn,
} from '@/functions/location-library';
import {
  sequenceLocationKeys,
  type TeamLibraryLocation,
} from '@/hooks/use-sequence-locations';
import type { LocationSheet } from '@/lib/db/schema/location-sheets';

/** Location with sheets for detail view */
export type LocationWithSheets = TeamLibraryLocation & {
  sheets: LocationSheet[];
};

/**
 * Query keys for location library
 */
export const locationLibraryKeys = {
  all: ['location-library'] as const,
  detail: (id: string) => [...locationLibraryKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch a single location with details and reference sheets
 */
export function useLibraryLocationById(locationId: string) {
  return useQuery<LocationWithSheets>({
    queryKey: locationLibraryKeys.detail(locationId),
    queryFn: () => getLibraryLocationByIdFn({ data: { locationId } }),
    enabled: !!locationId,
  });
}

/**
 * Hook to create a new library location
 */
export function useCreateLibraryLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      referenceImageUrls?: string[];
    }) => createLibraryLocationFn({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.teamLibrary,
      });
    },
  });
}

/**
 * Hook to update a library location
 */
export function useUpdateLibraryLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      locationId: string;
      name?: string;
      description?: string;
      referenceImageUrl?: string;
    }) => updateLibraryLocationFn({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: locationLibraryKeys.detail(variables.locationId),
      });
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.teamLibrary,
      });
    },
  });
}

/**
 * Hook to delete a library location
 */
export function useDeleteLibraryLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (locationId: string) =>
      deleteLibraryLocationFn({ data: { locationId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.teamLibrary,
      });
    },
  });
}

/**
 * Hook to upload location media to temp storage
 */
export function useUploadLocationMedia() {
  return useMutation({
    mutationFn: (data: {
      base64Data: string;
      filename: string;
      locationId?: string;
    }) => uploadLocationMediaFn({ data }),
  });
}

/**
 * Hook to add reference images to an existing location
 */
export function useAddLocationSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { locationId: string; imageUrls: string[] }) =>
      addLocationSheetsFn({ data }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: locationLibraryKeys.detail(variables.locationId),
      });
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.teamLibrary,
      });
    },
  });
}

/**
 * Hook to delete a reference image from a location
 */
export function useDeleteLocationSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { sheetId: string; locationId: string }) =>
      deleteLocationSheetFn({ data: { sheetId: data.sheetId } }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: locationLibraryKeys.detail(variables.locationId),
      });
      void queryClient.invalidateQueries({
        queryKey: sequenceLocationKeys.teamLibrary,
      });
    },
  });
}
