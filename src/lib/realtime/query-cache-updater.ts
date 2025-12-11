import type { QueryClient } from '@tanstack/react-query';
import type { Frame } from '@/types/database';
import { frameKeys } from '@/hooks/use-frames';
import { sequenceKeys } from '@/hooks/use-sequences';

type EventData = Record<string, unknown>;

// Debounce invalidations per query key - multiple rapid events = one refetch
const pendingInvalidations = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 100;

function debouncedInvalidate(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  debounceKey: string
) {
  // Clear any pending invalidation for this key
  const existing = pendingInvalidations.get(debounceKey);
  if (existing) clearTimeout(existing);

  // Schedule new invalidation
  const timeout = setTimeout(() => {
    pendingInvalidations.delete(debounceKey);
    void queryClient.invalidateQueries({ queryKey });
  }, DEBOUNCE_MS);

  pendingInvalidations.set(debounceKey, timeout);
}

/**
 * Updates TanStack Query cache based on realtime generation events.
 * This enables instant UI updates without polling.
 */
export function updateQueryCacheFromEvent(
  queryClient: QueryClient,
  sequenceId: string,
  eventName: string,
  data: EventData
) {
  switch (eventName) {
    case 'generation.frame:created':
      // Debounced invalidation - multiple rapid events = one refetch
      debouncedInvalidate(
        queryClient,
        frameKeys.list(sequenceId),
        `frames:${sequenceId}`
      );
      break;

    case 'generation.frame:updated':
      // Update frame metadata with prompts
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === data.frameId
            ? { ...f, metadata: data.metadata as Frame['metadata'] }
            : f
        )
      );
      break;

    case 'generation.image:progress':
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === data.frameId
            ? {
                ...f,
                thumbnailUrl: (data.thumbnailUrl as string) ?? f.thumbnailUrl,
                thumbnailStatus: data.status as Frame['thumbnailStatus'],
              }
            : f
        )
      );
      break;

    case 'generation.video:progress':
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === data.frameId
            ? {
                ...f,
                videoUrl: (data.videoUrl as string) ?? f.videoUrl,
                videoStatus: data.status as Frame['videoStatus'],
              }
            : f
        )
      );
      break;

    case 'generation.variant-image:progress':
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === data.frameId
            ? {
                ...f,
                variantImageUrl:
                  (data.variantImageUrl as string) ?? f.variantImageUrl,
                variantImageStatus: data.status as Frame['variantImageStatus'],
              }
            : f
        )
      );
      break;

    case 'generation.complete':
    case 'generation.failed':
    case 'generation.updated':
      // Invalidate sequence to get updated status/title
      void queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(sequenceId),
      });
      break;

    case 'generation.error':
      // Update frame status if frameId present
      if (data.frameId) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) =>
            f.id === data.frameId
              ? { ...f, thumbnailStatus: 'failed', videoStatus: 'failed' }
              : f
          )
        );
      }
      break;

    // Phase events don't need cache updates (UI-only via reducer state)
    // scene:new events don't need cache updates (analysis phase, no frames yet)
  }
}
