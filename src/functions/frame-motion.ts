/**
 * Frame Motion Server Functions
 * Motion/video generation operations for frames
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { sequenceAccessMiddleware, frameAccessMiddleware } from './middleware';
import { generateMotionSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { DEFAULT_VIDEO_MODEL, safeImageToVideoModel } from '@/lib/ai/models';
import type { MotionWorkflowInput } from '@/lib/workflow';
import { triggerWorkflow } from '@/lib/workflow';
import { getSequenceFrames } from '@/lib/db/helpers/frames';

// ============================================================================
// Generate Motion for Frame (Workflow Trigger)
// ============================================================================

const generateMotionInputSchema = generateMotionSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

/**
 * Generate motion video for a single frame
 * Triggers the motion workflow and returns the workflow run ID
 * @returns { workflowRunId: string, frameId: string }
 */
export const generateFrameMotionFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateMotionInputSchema))
  .handler(async ({ data, context }) => {
    const { frame, sequence, teamId } = context;

    // Check for thumbnail (required for motion generation)
    if (!frame.thumbnailUrl) {
      throw new Error('Frame has no thumbnail to generate motion from');
    }

    // Determine which prompt to use (priority: provided > stored > AI-generated > description)
    const promptToUse =
      data.prompt ||
      frame.motionPrompt ||
      frame.metadata?.prompts?.motion?.fullPrompt ||
      frame.description ||
      '';

    // Determine which model to use (priority: provided > frame's stored > sequence default > global default)
    const modelToUse = safeImageToVideoModel(
      data.model || frame.motionModel || sequence.videoModel,
      DEFAULT_VIDEO_MODEL
    );

    // Trigger motion generation workflow with deduplication
    const workflowInput: MotionWorkflowInput = {
      userId: context.user.id,
      teamId,
      frameId: frame.id,
      sequenceId: sequence.id,
      imageUrl: frame.thumbnailUrl,
      prompt: promptToUse,
      model: modelToUse,
      duration: data.duration,
      fps: data.fps,
      motionBucket: data.motionBucket,
      aspectRatio: sequence.aspectRatio,
    };

    const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
      deduplicationId: `motion-${frame.id}`,
    });

    return { workflowRunId, frameId: frame.id };
  });

// ============================================================================
// Batch Generate Motion for Sequence (Workflow Trigger)
// ============================================================================

const batchGenerateMotionInputSchema = z.object({
  sequenceId: ulidSchema,
  frameIds: z.array(ulidSchema).optional(),
  model: generateMotionSchema.shape.model,
  duration: generateMotionSchema.shape.duration,
  fps: generateMotionSchema.shape.fps,
  motionBucket: generateMotionSchema.shape.motionBucket,
});

type BatchMotionWorkflow = {
  frameId: string;
  workflowRunId: string;
  orderIndex: number;
};

type BatchMotionError = {
  frameId: string;
  error: string;
};

/**
 * Generate motion videos for multiple frames in a sequence
 * Triggers motion workflows for all frames with thumbnails
 * @returns { workflows: BatchMotionWorkflow[], errors?: BatchMotionError[] }
 */
export const batchGenerateMotionFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(batchGenerateMotionInputSchema))
  .handler(async ({ data, context }) => {
    const { sequence, teamId } = context;

    // Get frames for the sequence
    let allFrames = await getSequenceFrames(sequence.id);

    // Filter by specific frame IDs if provided
    if (data.frameIds && data.frameIds.length > 0) {
      allFrames = allFrames.filter((f) => data.frameIds?.includes(f.id));
    }

    if (allFrames.length === 0) {
      throw new Error('No frames found for sequence');
    }

    // Filter frames that have thumbnails
    const framesWithThumbnails = allFrames.filter((f) => f.thumbnailUrl);

    if (framesWithThumbnails.length === 0) {
      throw new Error('No frames with thumbnails found');
    }

    // Generate motion for each frame using workflows
    const workflows: BatchMotionWorkflow[] = [];
    const errors: BatchMotionError[] = [];

    for (const frame of framesWithThumbnails) {
      try {
        // TypeScript guard - we already filtered for frames with thumbnails
        if (!frame.thumbnailUrl) continue;

        // Use motion prompt or empty string as fallback
        const prompt = frame.motionPrompt || '';

        // Trigger motion workflow
        const workflowInput: MotionWorkflowInput = {
          userId: context.user.id,
          teamId,
          frameId: frame.id,
          sequenceId: sequence.id,
          imageUrl: frame.thumbnailUrl,
          prompt,
          model: data.model,
          duration: data.duration,
          fps: data.fps,
          motionBucket: data.motionBucket,
        };

        const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
          deduplicationId: `motion-${frame.id}`,
        });

        workflows.push({
          frameId: frame.id,
          workflowRunId,
          orderIndex: frame.orderIndex,
        });
      } catch (error) {
        errors.push({
          frameId: frame.id,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to start motion generation',
        });
      }
    }

    return {
      sequenceId: sequence.id,
      totalFrames: allFrames.length,
      framesWithThumbnails: framesWithThumbnails.length,
      workflowsStarted: workflows.length,
      workflows,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
