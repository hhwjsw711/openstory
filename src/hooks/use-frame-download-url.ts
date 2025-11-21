/**
 * Hook to fetch download URL for a frame's video
 */

import { useQuery } from '@tanstack/react-query';

interface DownloadUrlResponse {
  success: boolean;
  data?: {
    downloadUrl: string;
    filename: string;
  };
  message?: string;
}

export function useFrameDownloadUrl(
  frameId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ['frame-download-url', frameId],
    queryFn: async () => {
      if (!frameId) {
        throw new Error('Frame ID is required');
      }

      const response = await fetch(`/api/frames/${frameId}/download`);

      if (!response.ok) {
        const error: { message: string } = await response.json();
        throw new Error(error.message || 'Failed to fetch download URL');
      }

      const data: DownloadUrlResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to get download URL');
      }

      return data.data;
    },
    enabled: enabled && !!frameId,
    staleTime: 30 * 60 * 1000, // 30 minutes (URLs expire in 1 hour)
    gcTime: 45 * 60 * 1000, // 45 minutes
  });
}
