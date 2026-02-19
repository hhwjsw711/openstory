/**
 * Live workflow status hook.
 *
 * Polls QStash directly (via server function) to determine which
 * frames have active workflows. Replaces DB-stored status fields.
 *
 * Usage:
 * ```tsx
 * const frameIds = frames.map(f => f.id);
 * const { isImageGenerating, isMotionGenerating } = useWorkflowStatus(sequenceId, frameIds);
 *
 * // Check individual frame
 * isImageGenerating(frameId) // true if image workflow is running
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { getWorkflowStatusesFn } from '@/functions/workflow-status';
import type {
  FrameWorkflowStatuses,
  FrameWorkflowType,
} from '@/lib/workflow/status';

const POLL_INTERVAL_MS = 3000;
const STALE_TIME_MS = 2000;

/** Query key factory for workflow status */
export const workflowStatusKeys = {
  all: ['workflow-status'] as const,
  sequence: (sequenceId: string) =>
    [...workflowStatusKeys.all, sequenceId] as const,
};

type WorkflowStatusData = Record<string, FrameWorkflowStatuses>;

/**
 * Hook for live workflow status from QStash.
 *
 * Polls every 3s while any workflow is active, stops when all are idle.
 * Use `markGenerating` for optimistic updates when triggering workflows.
 */
export function useWorkflowStatus(
  sequenceId: string | undefined,
  frameIds: string[]
) {
  const queryClient = useQueryClient();

  const queryKey = workflowStatusKeys.sequence(sequenceId ?? '');

  const { data: statuses } = useQuery<WorkflowStatusData>({
    queryKey,
    queryFn: async () => {
      if (frameIds.length === 0) return {};
      return getWorkflowStatusesFn({ data: { frameIds } });
    },
    staleTime: STALE_TIME_MS,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;

      // Poll while any workflow is active
      const hasActive = Object.keys(data).length > 0;
      return hasActive ? POLL_INTERVAL_MS : false;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !!sequenceId && frameIds.length > 0,
  });

  const isGenerating = useCallback(
    (frameId: string, type: FrameWorkflowType): boolean => {
      return statuses?.[frameId]?.[type] === 'RUN_STARTED';
    },
    [statuses]
  );

  const isImageGenerating = useCallback(
    (frameId: string) => isGenerating(frameId, 'image'),
    [isGenerating]
  );

  const isMotionGenerating = useCallback(
    (frameId: string) => isGenerating(frameId, 'motion'),
    [isGenerating]
  );

  const isVariantGenerating = useCallback(
    (frameId: string) => isGenerating(frameId, 'variant'),
    [isGenerating]
  );

  /**
   * Optimistically mark a frame's workflow as active.
   * Call this right after triggering a workflow to avoid
   * a brief gap before the next QStash poll confirms it.
   */
  const markGenerating = useCallback(
    (frameId: string, type: FrameWorkflowType) => {
      queryClient.setQueryData<WorkflowStatusData>(queryKey, (old) => ({
        ...old,
        [frameId]: {
          ...old?.[frameId],
          [type]: 'RUN_STARTED' as const,
        },
      }));
    },
    [queryClient, queryKey]
  );

  /**
   * Build Sets of generating frame IDs (compatible with existing component props).
   */
  const generatingImages = useMemo(() => {
    const set = new Set<string>();
    if (statuses) {
      for (const [frameId, status] of Object.entries(statuses)) {
        if (status.image === 'RUN_STARTED') set.add(frameId);
      }
    }
    return set;
  }, [statuses]);

  const generatingMotion = useMemo(() => {
    const set = new Set<string>();
    if (statuses) {
      for (const [frameId, status] of Object.entries(statuses)) {
        if (status.motion === 'RUN_STARTED') set.add(frameId);
      }
    }
    return set;
  }, [statuses]);

  const generatingVariants = useMemo(() => {
    const set = new Set<string>();
    if (statuses) {
      for (const [frameId, status] of Object.entries(statuses)) {
        if (status.variant === 'RUN_STARTED') set.add(frameId);
      }
    }
    return set;
  }, [statuses]);

  return {
    statuses,
    isImageGenerating,
    isMotionGenerating,
    isVariantGenerating,
    isGenerating,
    markGenerating,
    generatingImages,
    generatingMotion,
    generatingVariants,
    queryKey,
  };
}
