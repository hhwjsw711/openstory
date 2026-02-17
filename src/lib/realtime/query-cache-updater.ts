import type { QueryClient } from '@tanstack/react-query';
import type { Frame, Sequence } from '@/types/database';
import { frameKeys } from '@/hooks/use-frames';
import { sequenceKeys } from '@/hooks/use-sequences';

/**
 * Helper to safely extract typed values from event data.
 * Uses runtime checks instead of unsafe type assertions.
 */
function getString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function getOptionalString(
  data: Record<string, unknown>,
  key: string
): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Type guard for Scene metadata from realtime events.
 * Performs minimal runtime validation since data is already Zod-validated upstream.
 */
function isSceneMetadata(value: unknown): value is Frame['metadata'] {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object') return false;
  // Check for required Scene fields using 'in' operator for type narrowing
  return (
    value !== null &&
    'sceneId' in value &&
    typeof value.sceneId === 'string' &&
    'sceneNumber' in value &&
    typeof value.sceneNumber === 'number'
  );
}

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
 * Validates if a status value is a valid Frame status.
 */
function isValidFrameStatus(
  status: unknown
): status is Frame['thumbnailStatus'] {
  return (
    status === 'pending' ||
    status === 'generating' ||
    status === 'completed' ||
    status === 'failed'
  );
}

/**
 * Updates TanStack Query cache based on realtime generation events.
 * This enables instant UI updates without polling.
 */
export function updateQueryCacheFromEvent(
  queryClient: QueryClient,
  sequenceId: string,
  eventName: string,
  data: Record<string, unknown>
) {
  const frameId = getString(data, 'frameId');

  switch (eventName) {
    case 'generation.frame:created':
      // Debounced invalidation - multiple rapid events = one refetch
      debouncedInvalidate(
        queryClient,
        frameKeys.list(sequenceId),
        `frames:${sequenceId}`
      );
      break;

    case 'generation.frame:updated': {
      // Update frame metadata with prompts
      // The metadata is validated by the realtime schema before reaching here
      const metadata = data.metadata;
      if (isSceneMetadata(metadata)) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) => (f.id === frameId ? { ...f, metadata } : f))
        );
      }
      break;
    }

    case 'generation.image:progress': {
      const thumbnailUrl = getOptionalString(data, 'thumbnailUrl');
      const status = data.status;
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === frameId
            ? {
                ...f,
                thumbnailUrl: thumbnailUrl ?? f.thumbnailUrl,
                thumbnailStatus: isValidFrameStatus(status)
                  ? status
                  : f.thumbnailStatus,
              }
            : f
        )
      );
      break;
    }

    case 'generation.video:progress': {
      const videoUrl = getOptionalString(data, 'videoUrl');
      const status = data.status;
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === frameId
            ? {
                ...f,
                videoUrl: videoUrl ?? f.videoUrl,
                videoStatus: isValidFrameStatus(status)
                  ? status
                  : f.videoStatus,
              }
            : f
        )
      );
      break;
    }

    case 'generation.variant-image:progress': {
      const variantImageUrl = getOptionalString(data, 'variantImageUrl');
      const status = data.status;
      queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
        old?.map((f) =>
          f.id === frameId
            ? {
                ...f,
                variantImageUrl: variantImageUrl ?? f.variantImageUrl,
                variantImageStatus: isValidFrameStatus(status)
                  ? status
                  : f.variantImageStatus,
              }
            : f
        )
      );
      break;
    }

    case 'generation.audio:progress': {
      const status = data.status;
      const audioUrl = getOptionalString(data, 'audioUrl');
      if (isValidFrameStatus(status)) {
        queryClient.setQueryData<Sequence>(
          sequenceKeys.detail(sequenceId),
          (old) =>
            old
              ? {
                  ...old,
                  musicStatus: status,
                  ...(audioUrl ? { musicUrl: audioUrl } : {}),
                }
              : old
        );
      }
      break;
    }

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
      if (frameId) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) =>
            f.id === frameId
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
