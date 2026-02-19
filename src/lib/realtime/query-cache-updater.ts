import type { QueryClient } from '@tanstack/react-query';
import type { Frame, Sequence } from '@/types/database';
import { frameKeys } from '@/hooks/use-frames';
import { sequenceKeys } from '@/hooks/use-sequences';
import { workflowStatusKeys } from '@/hooks/use-workflow-status';

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
 * Invalidate the workflow status query so the hook re-polls QStash.
 * Called when realtime events indicate a workflow completed or failed,
 * so the UI reflects the change immediately instead of waiting for the next poll.
 */
function invalidateWorkflowStatus(
  queryClient: QueryClient,
  sequenceId: string
) {
  debouncedInvalidate(
    queryClient,
    workflowStatusKeys.sequence(sequenceId),
    `workflow-status:${sequenceId}`
  );
}

/**
 * Updates TanStack Query cache based on realtime generation events.
 * This enables instant UI updates without polling.
 *
 * For content (URLs): updates frame cache directly.
 * For status changes: invalidates workflow status query to re-poll QStash.
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
      const metadata = data.metadata;
      if (isSceneMetadata(metadata)) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) => (f.id === frameId ? { ...f, metadata } : f))
        );
      }
      break;
    }

    case 'generation.image:progress': {
      // Update URL in frame cache (content), invalidate workflow status
      const thumbnailUrl = getOptionalString(data, 'thumbnailUrl');
      if (thumbnailUrl) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) => (f.id === frameId ? { ...f, thumbnailUrl } : f))
        );
      }
      // Workflow completed/failed — re-check QStash for updated status
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;
    }

    case 'generation.video:progress': {
      const videoUrl = getOptionalString(data, 'videoUrl');
      if (videoUrl) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) => (f.id === frameId ? { ...f, videoUrl } : f))
        );
      }
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;
    }

    case 'generation.variant-image:progress': {
      const variantImageUrl = getOptionalString(data, 'variantImageUrl');
      if (variantImageUrl) {
        queryClient.setQueryData<Frame[]>(frameKeys.list(sequenceId), (old) =>
          old?.map((f) => (f.id === frameId ? { ...f, variantImageUrl } : f))
        );
      }
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;
    }

    case 'generation.audio:progress': {
      const audioUrl = getOptionalString(data, 'audioUrl');
      if (audioUrl) {
        queryClient.setQueryData<Sequence>(
          sequenceKeys.detail(sequenceId),
          (old) => (old ? { ...old, musicUrl: audioUrl } : old)
        );
      }
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;
    }

    case 'generation.complete':
    case 'generation.failed':
    case 'generation.updated':
      // Invalidate sequence to get updated status/title
      void queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(sequenceId),
      });
      // Also refresh workflow status
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;

    case 'generation.error':
      // Invalidate workflow status — the workflow may have failed
      invalidateWorkflowStatus(queryClient, sequenceId);
      break;

    // Phase events don't need cache updates (UI-only via reducer state)
    // scene:new events don't need cache updates (analysis phase, no frames yet)
  }
}
