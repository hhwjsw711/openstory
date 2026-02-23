import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { sequenceAccessMiddleware, frameAccessMiddleware } from './middleware';
import {
  singleFrameSchema,
  bulkFrameSchema,
  updateFrameSchema,
} from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  getSequenceFrames,
  createFrame,
  bulkInsertFrames,
  updateFrame,
  deleteFrame,
  deleteSequenceFrames,
  reorderFrames,
} from '@/lib/db/helpers/frames';
import { getVideoDownloadUrl } from '@/lib/motion/video-storage';
import type { NewFrame } from '@/lib/db/schema';
import { reconcileStaleFrameStatuses } from '@/lib/workflow/reconcile';

const frameIdInputSchema = z.object({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

export const getFramesFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    const frames = await getSequenceFrames(context.sequence.id);

    // Fire-and-forget: reconcile stale statuses in background
    reconcileStaleFrameStatuses(frames).catch(console.error);

    return frames;
  });

export const getFrameFn = createServerFn({ method: 'GET' })
  .middleware([frameAccessMiddleware])
  .handler(async ({ context }) => {
    return context.frame;
  });

export const createFrameFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(
    zodValidator(singleFrameSchema.extend({ sequenceId: ulidSchema }))
  )
  .handler(async ({ data }) => {
    return createFrame(data);
  });

export const createFramesBulkFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        sequenceId: ulidSchema,
        frames: bulkFrameSchema.shape.frames,
      })
    )
  )
  .handler(async ({ data }) => {
    const frameInserts: NewFrame[] = data.frames.map((frame) => ({
      sequenceId: data.sequenceId,
      ...frame,
    }));
    return bulkInsertFrames(frameInserts);
  });

export const updateFrameFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(
    zodValidator(
      updateFrameSchema.extend({ sequenceId: ulidSchema, frameId: ulidSchema })
    )
  )
  .handler(async ({ data }) => {
    const { sequenceId: _, frameId, ...updateData } = data;
    return updateFrame(frameId, updateData);
  });

export const deleteFrameFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(frameIdInputSchema))
  .handler(async ({ data }) => {
    await deleteFrame(data.frameId);
    return { success: true, sequenceId: data.sequenceId };
  });

export const deleteFramesBySequenceFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    await deleteSequenceFrames(context.sequence.id);
    return { success: true };
  });

export const reorderFramesFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        sequenceId: ulidSchema,
        frameOrders: z
          .array(z.object({ id: ulidSchema, orderIndex: z.number().int() }))
          .min(1),
      })
    )
  )
  .handler(async ({ data }) => {
    const frameOrders = data.frameOrders.map((f) => ({
      id: f.id,
      order_index: f.orderIndex,
    }));
    await reorderFrames(data.sequenceId, frameOrders);
    return { success: true };
  });

/**
 * Get a signed download URL for a frame's video.
 * Uses Content-Disposition: attachment to force browser download.
 */
export const getFrameDownloadUrlFn = createServerFn({ method: 'GET' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(frameIdInputSchema))
  .handler(async ({ context }) => {
    const { frame } = context;

    if (!frame.videoPath) {
      throw new Error('Frame does not have a video');
    }

    const filename =
      frame.videoPath.split('/').pop() || `scene-${frame.id}_velro.mp4`;

    const downloadUrl = await getVideoDownloadUrl(
      frame.videoPath,
      filename,
      3600
    );

    return { downloadUrl, filename };
  });
