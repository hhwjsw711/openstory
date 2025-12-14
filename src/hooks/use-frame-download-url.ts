import { getFrameDownloadUrlFn } from '@/functions/frames';
import { useQuery } from '@tanstack/react-query';

type UseFrameDownloadUrlParams = {
  frameId?: string;
  sequenceId?: string;
};

/**
 * Hook to get a signed download URL for a frame's video.
 * Uses Content-Disposition header to force browser download.
 *
 * @param params - Frame and sequence IDs
 * @param enabled - Whether to fetch (default: true)
 * @returns Query result with downloadUrl and filename
 */
export function useFrameDownloadUrl(
  { frameId, sequenceId }: UseFrameDownloadUrlParams,
  enabled = true
) {
  return useQuery({
    queryKey: ['frame-download-url', frameId, sequenceId],
    queryFn: async () => {
      if (!frameId || !sequenceId) {
        throw new Error('Frame ID and Sequence ID are required');
      }
      return getFrameDownloadUrlFn({ data: { frameId, sequenceId } });
    },
    enabled: enabled && !!frameId && !!sequenceId,
    staleTime: 30 * 60 * 1000, // 30 minutes (URLs expire in 1 hour)
  });
}
