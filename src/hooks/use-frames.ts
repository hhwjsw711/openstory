import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFrameInput,
  UpdateFrameInput,
  GenerateFramesInput,
  RegenerateFrameInput,
} from "#actions/frames";
import {
  bulkCreateFrames,
  createFrame,
  deleteFrame,
  deleteFramesBySequence,
  generateFramesAction,
  getFrame,
  getFramesBySequence,
  regenerateFrameAction,
  reorderFrames,
  updateFrame,
} from "#actions/frames";
import type { Frame, Job } from "@/types/database";

// Query keys
export const frameKeys = {
  all: ["frames"] as const,
  lists: () => [...frameKeys.all, "list"] as const,
  list: (sequenceId: string) => [...frameKeys.lists(), sequenceId] as const,
  details: () => [...frameKeys.all, "detail"] as const,
  detail: (id: string) => [...frameKeys.details(), id] as const,
};

// Hook for listing frames by sequence
export function useFramesBySequence(sequenceId: string) {
  return useQuery<Frame[]>({
    queryKey: frameKeys.list(sequenceId),
    queryFn: async () => {
      const result = await getFramesBySequence(sequenceId);
      if (result.success && result.frames) {
        return result.frames;
      }
      throw new Error(result.error || "Failed to load frames");
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!sequenceId,
  });
}

// Hook for getting single frame
export function useFrame(frameId: string) {
  return useQuery<Frame>({
    queryKey: frameKeys.detail(frameId),
    queryFn: async () => {
      const result = await getFrame(frameId);
      if (result.success && result.frame) {
        return result.frame;
      }
      throw new Error(result.error || "Failed to load frame");
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!frameId,
  });
}

// Hook for creating frame
export function useCreateFrame() {
  const queryClient = useQueryClient();

  return useMutation<Frame, Error, CreateFrameInput>({
    mutationFn: async (input: CreateFrameInput) => {
      const result = await createFrame(input);
      if (result.success && result.frame) {
        return result.frame;
      }
      throw new Error(result.error || "Failed to create frame");
    },
    onSuccess: (data) => {
      // Invalidate frames list for the sequence
      if (data?.sequence_id) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(data.sequence_id),
        });
      }
    },
  });
}

// Hook for updating frame
export function useUpdateFrame() {
  const queryClient = useQueryClient();

  return useMutation<Frame, Error, UpdateFrameInput>({
    mutationFn: async (input: UpdateFrameInput) => {
      const result = await updateFrame(input);
      if (result.success && result.frame) {
        return result.frame;
      }
      throw new Error(result.error || "Failed to update frame");
    },
    onSuccess: (data) => {
      // Update the specific frame in cache
      if (data?.id) {
        queryClient.setQueryData(frameKeys.detail(data.id), data);
      }
      // Invalidate frames list for the sequence
      if (data?.sequence_id) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(data.sequence_id),
        });
      }
    },
  });
}

// Hook for deleting frame
export function useDeleteFrame() {
  const queryClient = useQueryClient();

  return useMutation<{ frameId: string; sequenceId?: string }, Error, string>({
    mutationFn: async (frameId: string) => {
      // First get the frame to know its sequence_id
      const frameData = queryClient.getQueryData<Frame>(
        frameKeys.detail(frameId),
      );
      const result = await deleteFrame({ id: frameId });
      if (result.success) {
        return { frameId, sequenceId: frameData?.sequence_id };
      }
      throw new Error(result.error || "Failed to delete frame");
    },
    onSuccess: ({ frameId, sequenceId }) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: frameKeys.detail(frameId) });
      // Invalidate sequence frames list
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
      frameOrders: Array<{ id: string; order_index: number }>;
    },
    { previousFrames: Frame[] | undefined; sequenceId: string }
  >({
    mutationFn: async ({
      sequenceId,
      frameOrders,
    }: {
      sequenceId: string;
      frameOrders: Array<{ id: string; order_index: number }>;
    }) => {
      const result = await reorderFrames(sequenceId, frameOrders);
      if (result.success) {
        return { sequenceId };
      }
      throw new Error(result.error || "Failed to reorder frames");
    },
    onMutate: async ({ sequenceId, frameOrders }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: frameKeys.list(sequenceId),
      });

      // Snapshot previous value
      const previousFrames = queryClient.getQueryData<Frame[]>(
        frameKeys.list(sequenceId),
      );

      // Optimistically update frames order
      if (previousFrames) {
        const reorderedFrames = previousFrames
          .map((frame) => {
            const newOrder = frameOrders.find((o) => o.id === frame.id);
            return newOrder
              ? { ...frame, order_index: newOrder.order_index }
              : frame;
          })
          .sort((a, b) => a.order_index - b.order_index);

        queryClient.setQueryData(frameKeys.list(sequenceId), reorderedFrames);
      }

      return { previousFrames, sequenceId };
    },
    onError: (_, __, context) => {
      // Rollback to previous value on error
      if (context?.previousFrames && context.sequenceId) {
        queryClient.setQueryData(
          frameKeys.list(context.sequenceId),
          context.previousFrames,
        );
      }
    },
    onSettled: (_, __, { sequenceId }) => {
      // Always refetch after error or success
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
      frames: Omit<CreateFrameInput, "sequence_id">[];
    }
  >({
    mutationFn: async ({
      sequenceId,
      frames,
    }: {
      sequenceId: string;
      frames: Omit<CreateFrameInput, "sequence_id">[];
    }) => {
      const result = await bulkCreateFrames(sequenceId, frames);
      if (result.success && result.frames) {
        return result.frames;
      }
      throw new Error(result.error || "Failed to create frames");
    },
    onSuccess: (_, { sequenceId }) => {
      // Invalidate frames list for the sequence
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
      const result = await deleteFramesBySequence(sequenceId);
      if (result.success) {
        return sequenceId;
      }
      throw new Error(result.error || "Failed to delete frames");
    },
    onSuccess: (sequenceId) => {
      // Clear frames list for the sequence
      queryClient.setQueryData(frameKeys.list(sequenceId), []);
      // Invalidate to ensure fresh data
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
      const result = await generateFramesAction(input);
      if (result.success && result.jobId) {
        return { jobId: result.jobId, message: result.message };
      }
      throw new Error(result.error || "Failed to generate frames");
    },
    onMutate: async ({ sequenceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: frameKeys.list(sequenceId),
      });

      // Snapshot previous frames
      const previousFrames = queryClient.getQueryData<Frame[]>(
        frameKeys.list(sequenceId)
      );

      return { previousFrames, sequenceId };
    },
    onSuccess: (_, { sequenceId }) => {
      // Invalidate frames list to show placeholder frames
      queryClient.invalidateQueries({
        queryKey: frameKeys.list(sequenceId),
      });
    },
    onError: (_, __, context) => {
      // Rollback to previous frames on error
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
      const result = await regenerateFrameAction(input);
      if (result.success && result.jobId) {
        return { jobId: result.jobId };
      }
      throw new Error(result.error || "Failed to regenerate frame");
    },
    onSuccess: (_, { frameId }) => {
      // Invalidate the specific frame
      queryClient.invalidateQueries({
        queryKey: frameKeys.detail(frameId),
      });
      
      // Also invalidate the frames list if we can determine the sequence
      const frameData = queryClient.getQueryData<Frame>(
        frameKeys.detail(frameId)
      );
      if (frameData?.sequence_id) {
        queryClient.invalidateQueries({
          queryKey: frameKeys.list(frameData.sequence_id),
        });
      }
    },
  });
}

// Hook for polling frame generation status
export function useFrameGenerationStatus(
  jobId: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery<Job | null>({
    queryKey: ["jobs", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      // This would typically call an API to get job status
      // For now, returning null as we need to implement the job status endpoint
      const response = await fetch(`/api/v1/jobs/status/${jobId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }
      return response.json();
    },
    enabled: !!jobId && (options?.enabled ?? true),
    refetchInterval: (data) => {
      // Stop polling if job is completed or failed
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      // Poll every 2 seconds by default
      return options?.refetchInterval ?? 2000;
    },
  });
}
