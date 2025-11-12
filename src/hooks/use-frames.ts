import type { Frame } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface CreateFrameInput {
  sequenceId: string;
  description: string;
  orderIndex: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  durationMs?: number;
  metadata?: unknown;
}

export interface UpdateFrameInput {
  id: string;
  description?: string;
  orderIndex?: number;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  durationMs?: number | null;
  metadata?: unknown;
}

export interface GenerateFramesInput {
  sequenceId: string;
}

export interface RegenerateFrameInput {
  sequenceId: string;
  frameId: string;
  regenerateDescription?: boolean;
  regenerateThumbnail?: boolean;
}

// Query keys
export const frameKeys = {
  all: ['frames'] as const,
  lists: () => [...frameKeys.all, 'list'] as const,
  list: (sequenceId: string) => [...frameKeys.lists(), sequenceId] as const,
  details: () => [...frameKeys.all, 'detail'] as const,
  detail: (id: string) => [...frameKeys.details(), id] as const,
};

// Hook for listing frames by sequence with optional auto-refresh
export function useFramesBySequence(
  sequenceId?: string,
  options?: {
    refetchInterval?: number | false;
    staleTime?: number;
  }
) {
  return useQuery<Frame[]>({
    queryKey: frameKeys.list(sequenceId ?? ''),
    queryFn: async () => {
      const response = await fetch(`/api/sequences/${sequenceId}/frames`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load frames');
      }

      return result.data;
    },
    staleTime: options?.staleTime ?? 1000, // Default to 1 second for better responsiveness
    refetchInterval: (query) => {
      if (!query.state.data) return 1000;

      const frames = query.state.data;

      // Phase-aware polling using existing status fields:
      // - Phases 1-5 (Script Analysis): sequence.status === 'processing' with no image/video generation
      // - Phase 6 (Images): Any frame.thumbnailStatus === 'generating'
      // - Phase 7 (Videos): Any frame.videoStatus === 'generating'
      const isGeneratingImages = frames.some(
        (f: Frame) =>
          f.thumbnailStatus === 'pending' || f.thumbnailStatus === 'generating'
      );
      const isGeneratingVideos = frames.some(
        (f: Frame) =>
          f.videoStatus === 'pending' || f.videoStatus === 'generating'
      );

      // Phases 6-7: Image/video generation (rapid parallel updates)
      // Poll faster for snappier UI updates as thumbnails/videos complete
      if (frames.length > 0 && !isGeneratingImages && !isGeneratingVideos) {
        return false;
      }

      return 2000; // 1 second
    },
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
    enabled: !!sequenceId,
  });
}

// Hook for getting single frame
export function useFrame(sequenceId: string, frameId: string) {
  return useQuery<Frame>({
    queryKey: frameKeys.detail(frameId),
    queryFn: async () => {
      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/${frameId}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load frame');
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!sequenceId && !!frameId,
  });
}

// Hook for creating frame
export function useCreateFrame() {
  const queryClient = useQueryClient();

  return useMutation<Frame, Error, CreateFrameInput>({
    mutationFn: async (input: CreateFrameInput) => {
      const { sequenceId, ...frameData } = input;
      const response = await fetch(`/api/sequences/${sequenceId}/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(frameData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create frame');
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (data?.sequenceId) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(data.sequenceId),
        });
      }
    },
  });
}

// Hook for updating frame
export function useUpdateFrame() {
  const queryClient = useQueryClient();

  return useMutation<Frame, Error, UpdateFrameInput & { sequenceId: string }>({
    mutationFn: async (input) => {
      const { id, sequenceId, ...updateData } = input;

      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update frame');
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.setQueryData(frameKeys.detail(data.id), data);
      }
      if (data?.sequenceId) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(data.sequenceId),
        });
      }
    },
  });
}

// Hook for deleting frame
export function useDeleteFrame() {
  const queryClient = useQueryClient();

  return useMutation<
    { frameId: string; sequenceId?: string },
    Error,
    { sequenceId: string; frameId: string }
  >({
    mutationFn: async ({ sequenceId, frameId }) => {
      const frameData = queryClient.getQueryData<Frame>(
        frameKeys.detail(frameId)
      );

      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/${frameId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete frame');
      }

      return { frameId, sequenceId: frameData?.sequenceId };
    },
    onSuccess: ({ frameId, sequenceId }) => {
      queryClient.removeQueries({ queryKey: frameKeys.detail(frameId) });
      if (sequenceId) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(sequenceId),
        });
      }
    },
  });
}

// Hook for reordering frames
export function useReorderFrames() {
  const queryClient = useQueryClient();

  return useMutation<
    { sequenceId: string },
    Error,
    {
      sequenceId: string;
      frameOrders: Array<{ id: string; orderIndex: number }>;
    },
    { previousFrames: Frame[] | undefined; sequenceId: string }
  >({
    mutationFn: async ({
      sequenceId,
      frameOrders,
    }: {
      sequenceId: string;
      frameOrders: Array<{ id: string; orderIndex: number }>;
    }) => {
      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/reorder`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ frameOrders }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to reorder frames');
      }

      return { sequenceId };
    },
    onMutate: async ({ sequenceId, frameOrders }) => {
      await queryClient.cancelQueries({
        queryKey: frameKeys.list(sequenceId),
      });

      const previousFrames = queryClient.getQueryData<Frame[]>(
        frameKeys.list(sequenceId)
      );

      if (previousFrames) {
        const reorderedFrames = previousFrames
          .map((frame) => {
            const newOrder = frameOrders.find((o) => o.id === frame.id);
            return newOrder
              ? { ...frame, orderIndex: newOrder.orderIndex }
              : frame;
          })
          .sort((a, b) => a.orderIndex - b.orderIndex);

        queryClient.setQueryData(frameKeys.list(sequenceId), reorderedFrames);
      }

      return { previousFrames, sequenceId };
    },
    onError: (_, __, context) => {
      if (context?.previousFrames && context.sequenceId) {
        queryClient.setQueryData(
          frameKeys.list(context.sequenceId),
          context.previousFrames
        );
      }
    },
    onSettled: (_, __, { sequenceId }) => {
      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });
    },
  });
}

// Hook for bulk creating frames
export function useBulkCreateFrames() {
  const queryClient = useQueryClient();

  return useMutation<
    Frame[],
    Error,
    {
      sequenceId: string;
      frames: Omit<CreateFrameInput, 'sequenceId'>[];
    }
  >({
    mutationFn: async ({
      sequenceId,
      frames,
    }: {
      sequenceId: string;
      frames: Omit<CreateFrameInput, 'sequenceId'>[];
    }) => {
      const response = await fetch(`/api/sequences/${sequenceId}/frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frames }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create frames');
      }

      return result.data;
    },
    onSuccess: (_, { sequenceId }) => {
      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });
    },
  });
}

// Hook for deleting all frames in a sequence
export function useDeleteFramesBySequence() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: async (sequenceId: string) => {
      const response = await fetch(`/api/sequences/${sequenceId}/frames`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete frames');
      }

      return sequenceId;
    },
    onSuccess: (sequenceId) => {
      queryClient.setQueryData(frameKeys.list(sequenceId), []);
      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });
    },
  });
}

// Hook for generating frames with AI
export function useGenerateFrames() {
  const queryClient = useQueryClient();

  return useMutation<
    { jobId: string; message?: string },
    Error,
    GenerateFramesInput,
    { previousFrames: Frame[] | undefined; sequenceId: string }
  >({
    mutationFn: async (input: GenerateFramesInput) => {
      const response = await fetch(
        `/api/sequences/${input.sequenceId}/frames/generate`,
        {
          method: 'POST',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to generate frames');
      }

      return {
        jobId: result.data.jobId,
        message: result.message,
      };
    },
    onMutate: async ({ sequenceId }) => {
      await queryClient.cancelQueries({
        queryKey: frameKeys.list(sequenceId),
      });

      const previousFrames = queryClient.getQueryData<Frame[]>(
        frameKeys.list(sequenceId)
      );

      return { previousFrames, sequenceId };
    },
    onSuccess: (_, { sequenceId }) => {
      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });

      queryClient.invalidateQueries({
        queryKey: ['active-job', sequenceId],
      });
    },
    onError: (_, __, context) => {
      if (context?.previousFrames && context.sequenceId) {
        queryClient.setQueryData(
          frameKeys.list(context.sequenceId),
          context.previousFrames
        );
      }
    },
  });
}

// Hook for regenerating a single frame
export function useRegenerateFrame() {
  const queryClient = useQueryClient();

  return useMutation<{ jobId: string }, Error, RegenerateFrameInput>({
    mutationFn: async (input: RegenerateFrameInput) => {
      const { sequenceId, frameId, ...body } = input;

      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/${frameId}/regenerate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to regenerate frame');
      }

      return { jobId: result.data.jobId };
    },
    onSuccess: (_, { sequenceId, frameId }) => {
      queryClient.invalidateQueries({
        queryKey: frameKeys.detail(frameId),
      });

      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });
    },
  });
}

// Hook to check for active frame generation jobs for a sequence
export function useActiveFrameGeneration(sequenceId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['active-job', sequenceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/sequences/${sequenceId}/frames/generation/status`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(result.message || 'Failed to get active job');
      }

      const job = result.data;

      if (job && (job.status === 'running' || job.status === 'completed')) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(sequenceId),
        });
      }

      return job;
    },
    enabled: !!sequenceId,
    refetchInterval: (query) => {
      if (
        !query.state.data ||
        query.state.data.status === 'completed' ||
        query.state.data.status === 'failed'
      ) {
        if (query.state.data?.status === 'completed') {
          queryClient.invalidateQueries({
            queryKey: frameKeys.list(sequenceId),
          });
        }
        return false;
      }
      return 2000;
    },
  });
}

// Hook to track preview image generation status for frames
export function useFramePreviewStatus(frames: Frame[]) {
  // Get frames that might be generating previews (no thumbnailUrl but were recently created)
  const framesNeedingPreviews = useMemo(() => {
    return frames.filter((frame) => {
      if (frame.thumbnailUrl) return false; // Already has preview

      // Check if frame was created recently (within last 2 minutes for faster timeout)
      const createdAt = new Date(frame.createdAt).getTime();
      const now = Date.now();
      const twoMinutesAgo = now - 2 * 60 * 1000;

      return createdAt > twoMinutesAgo;
    });
  }, [frames]);

  // Auto-refresh frames list when there are frames potentially generating previews
  const { data: refreshedFrames = frames } = useFramesBySequence(
    frames.length > 0 ? frames[0].sequenceId : '',
    {
      refetchInterval: framesNeedingPreviews.length > 0 ? 2000 : false, // Faster refresh
      staleTime: 500, // Shorter stale time for preview updates
    }
  );

  // Return status map for each frame
  return useMemo(() => {
    const statusMap = new Map<
      string,
      { isGenerating: boolean; hasPreview: boolean }
    >();

    refreshedFrames.forEach((frame) => {
      const hasPreview = !!frame.thumbnailUrl;

      // Check if this frame should show as generating
      let isGenerating = false;
      if (!hasPreview) {
        const createdAt = new Date(frame.createdAt).getTime();
        const updatedAt = frame.updatedAt
          ? new Date(frame.updatedAt).getTime()
          : createdAt;
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;

        // Only show as generating if created recently
        isGenerating = createdAt > twoMinutesAgo || updatedAt > twoMinutesAgo;
      }

      statusMap.set(frame.id, {
        isGenerating,
        hasPreview,
      });
    });

    return statusMap;
  }, [refreshedFrames]);
}
