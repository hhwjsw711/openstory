import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Frame, Sequence } from '@/types/database';
import { frameKeys } from './use-frames';
import { sequenceKeys } from './use-sequences';

/**
 * Type for sequence metadata containing frame generation information
 * Note: This is still used by components for displaying progress and error details
 * but is NOT used for determining isGenerating status (which uses workflow status)
 */
export interface FrameGenerationMetadata {
  frameGeneration?: {
    status?: string;
    expectedFrameCount?: number;
    completedFrameCount?: number;
    error?: string;
    failedAt?: string;
  };
}

export interface Job {
  id: string;
  type: string;
  status: string;
  progress?: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  framesProgress?: {
    total: number;
    completed: number;
    frames: Array<{
      id: string;
      orderIndex: number;
      thumbnailUrl?: string | null;
    }>;
  };
}

interface StoryboardStatus {
  sequence: Sequence | null;
  frames: Frame[];
  activeJob?: Job | null;
  isGenerating: boolean;
  hasFrames: boolean;
  canGenerate: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Unified hook for managing storyboard status and polling
 * Consolidates sequence, frames, and job status into a single coordinated query
 * Follows React rules: minimal React, externalized logic, TanStack Query for data fetching
 */
export function useStoryboardStatus(sequenceId: string): StoryboardStatus {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: ['storyboard-status', sequenceId],
    queryFn: async () => {
      const [sequenceResponse, framesResponse] = await Promise.all([
        fetch(`/api/sequences/${sequenceId}`),
        fetch(`/api/sequences/${sequenceId}/frames`),
      ]);

      const [sequenceResult, framesResult] = await Promise.all([
        sequenceResponse.json(),
        framesResponse.json(),
      ]);

      const sequence =
        sequenceResponse.ok && sequenceResult.success
          ? sequenceResult.data
          : null;
      const frames =
        framesResponse.ok && framesResult.success
          ? framesResult.data || []
          : [];

      return {
        sequence: sequence as Sequence | null,
        frames,
      };
    },
    enabled: !!sequenceId,
    staleTime: 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (!query.state.data) return false;

      const { sequence, frames } = query.state.data;

      // Check if any workflows are active (vanilla TypeScript logic)
      // - Parent storyboard workflow: sequence.status === 'processing'
      // - Child image workflows: any frame has thumbnailStatus === 'generating'
      // - Child video workflows: any frame has videoStatus === 'generating'
      const isParentWorkflowActive = sequence?.status === 'processing';
      const hasActiveChildWorkflows = frames.some(
        (f: Frame) =>
          f.thumbnailStatus === 'generating' || f.videoStatus === 'generating'
      );

      const isGenerating = isParentWorkflowActive || hasActiveChildWorkflows;
      return isGenerating ? 2000 : false;
    },
  });

  const refetch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(sequenceId),
      }),
      queryClient.invalidateQueries({ queryKey: frameKeys.list(sequenceId) }),
    ]);

    await refetchQuery();
  };

  const derivedState = useMemo(() => {
    if (!data) {
      return {
        sequence: null,
        frames: [],
        activeJob: null,
        isGenerating: false,
        hasFrames: false,
        canGenerate: false,
      };
    }

    const { sequence, frames } = data;

    // Check if any workflows are active (vanilla TypeScript logic)
    // - Parent storyboard workflow: sequence.status === 'processing'
    // - Child image workflows: any frame has thumbnailStatus === 'generating'
    // - Child video workflows: any frame has videoStatus === 'generating'
    const isParentWorkflowActive = sequence?.status === 'processing';
    const hasActiveChildWorkflows = frames.some(
      (f: Frame) =>
        f.thumbnailStatus === 'generating' || f.videoStatus === 'generating'
    );
    const isGenerating = isParentWorkflowActive || hasActiveChildWorkflows;

    const hasFrames = frames.length > 0;
    const styleId = sequence?.styleId;

    // Can generate if we have script, style, and not currently generating
    const canGenerate = Boolean(
      sequence?.script &&
        sequence.script.trim().length >= 10 &&
        styleId &&
        !isGenerating
    );

    // Build activeJob for backwards compatibility with components
    // Get expected frame count from metadata
    const metadata = sequence?.metadata as FrameGenerationMetadata | null;
    const expectedFrameCount =
      metadata?.frameGeneration?.expectedFrameCount || 3;
    const completedFrames = frames.filter((f: Frame) => f.thumbnailUrl).length;

    const activeJob = isGenerating
      ? {
          id: 'storyboard-generation',
          type: 'storyboard',
          status: 'running' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          framesProgress: {
            total: expectedFrameCount,
            completed: completedFrames,
            frames: frames.map((f: Frame) => ({
              id: f.id,
              orderIndex: f.orderIndex,
              thumbnailUrl: f.thumbnailUrl,
            })),
          },
        }
      : null;

    return {
      sequence,
      frames,
      activeJob,
      isGenerating,
      hasFrames,
      canGenerate,
    };
  }, [data]);

  return {
    ...derivedState,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export function useIsGenerating(sequenceId: string): boolean {
  const { isGenerating } = useStoryboardStatus(sequenceId);
  return isGenerating;
}

export function useStoryboardFrames(sequenceId: string): {
  frames: Frame[];
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const { frames, isLoading, refetch } = useStoryboardStatus(sequenceId);
  return { frames, isLoading, refetch };
}
