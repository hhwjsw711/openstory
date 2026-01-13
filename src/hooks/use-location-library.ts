/**
 * Hooks for team-level location library operations
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
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
  libraryLocationKeys,
  sequenceLocationKeys,
} from '@/hooks/use-sequence-locations';
import type { LibraryLocation, LocationSheet } from '@/lib/db/schema';

/** Library location with sheets for detail view */
export type LibraryLocationWithSheets = LibraryLocation & {
  sequenceTitle: string; // For backwards compatibility - always 'Library' for library locations
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
 * Invalidate all location-related queries.
 * Use after mutations that affect location data.
 */
function invalidateLocationQueries(
  queryClient: QueryClient,
  locationId?: string
): void {
  if (locationId) {
    void queryClient.invalidateQueries({
      queryKey: locationLibraryKeys.detail(locationId),
    });
  }
  void queryClient.invalidateQueries({ queryKey: libraryLocationKeys.all });
  void queryClient.invalidateQueries({
    queryKey: sequenceLocationKeys.teamLibrary,
  });
}

/**
 * Hook to fetch a single location with details and reference sheets
 */
export function useLibraryLocationById(locationId: string) {
  return useQuery<LibraryLocationWithSheets>({
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
    onSuccess: () => invalidateLocationQueries(queryClient),
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
    onSuccess: (_, variables) =>
      invalidateLocationQueries(queryClient, variables.locationId),
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
    onSuccess: () => invalidateLocationQueries(queryClient),
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
    onSuccess: (_, variables) =>
      invalidateLocationQueries(queryClient, variables.locationId),
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
    onSuccess: (_, variables) =>
      invalidateLocationQueries(queryClient, variables.locationId),
  });
}
