/**
 * Frame Server Functions
 * End-to-end type-safe functions for frame operations
 */

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
import { frameService } from '@/lib/services/frame.service';
import type { NewFrame } from '@/lib/db/schema';

// ============================================================================
// List Frames
// ============================================================================

/**
 * Get all frames for a sequence
 * @returns Array of frames with fresh signed URLs
 */
export const getFramesFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    const frames = await frameService.getFramesBySequence(context.sequence.id);
    return frameService.enrichFramesWithSignedUrls(frames);
  });

// ============================================================================
// Get Single Frame
// ============================================================================

/**
 * Get a single frame by ID
 * @returns The frame with fresh signed URLs
 */
export const getFrameFn = createServerFn({ method: 'GET' })
  .middleware([frameAccessMiddleware])
  .handler(async ({ context }) => {
    return frameService.enrichFrameWithSignedUrls(context.frame);
  });

// ============================================================================
// Create Frame
// ============================================================================

const createFrameInputSchema = singleFrameSchema.extend({
  sequenceId: ulidSchema,
});

/**
 * Create a single frame
 * @returns The created frame
 */
export const createFrameFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(createFrameInputSchema))
  .handler(async ({ data }) => {
    return frameService.createFrame(data);
  });

// ============================================================================
// Bulk Create Frames
// ============================================================================

const bulkCreateFramesInputSchema = z.object({
  sequenceId: ulidSchema,
  frames: bulkFrameSchema.shape.frames,
});

/**
 * Create multiple frames at once
 * @returns Array of created frames
 */
export const createFramesBulkFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(bulkCreateFramesInputSchema))
  .handler(async ({ data }) => {
    const frameInserts: NewFrame[] = data.frames.map((frame) => ({
      sequenceId: data.sequenceId,
      ...frame,
    }));
    return frameService.bulkInsertFrames(frameInserts);
  });

// ============================================================================
// Update Frame
// ============================================================================

const updateFrameInputSchema = updateFrameSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

/**
 * Update a frame
 * @returns The updated frame
 */
export const updateFrameFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(updateFrameInputSchema))
  .handler(async ({ data }) => {
    const { sequenceId: _, frameId, ...updateData } = data;
    return frameService.updateFrame({ id: frameId, ...updateData });
  });

// ============================================================================
// Delete Frame
// ============================================================================

const deleteFrameInputSchema = z.object({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

/**
 * Delete a frame
 * @returns The deleted frame's sequence ID
 */
export const deleteFrameFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(deleteFrameInputSchema))
  .handler(async ({ data }) => {
    await frameService.deleteFrame(data.frameId);
    return { success: true, sequenceId: data.sequenceId };
  });

// ============================================================================
// Delete All Frames by Sequence
// ============================================================================

/**
 * Delete all frames for a sequence
 */
export const deleteFramesBySequenceFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    await frameService.deleteFramesBySequence(context.sequence.id);
    return { success: true };
  });

// ============================================================================
// Reorder Frames
// ============================================================================

const reorderFramesInputSchema = z.object({
  sequenceId: ulidSchema,
  frameOrders: z
    .array(
      z.object({
        id: ulidSchema,
        orderIndex: z.number().int(),
      })
    )
    .min(1),
});

/**
 * Reorder frames in a sequence
 */
export const reorderFramesFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(reorderFramesInputSchema))
  .handler(async ({ data }) => {
    // Map to service format (order_index vs orderIndex)
    const frameOrders = data.frameOrders.map((f) => ({
      id: f.id,
      order_index: f.orderIndex,
    }));
    await frameService.reorderFrames(data.sequenceId, frameOrders);
    return { success: true };
  });
