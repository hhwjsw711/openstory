/**
 * Motion Server Functions
 * Motion/video generation operations including frame motion and merged video
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { DEFAULT_VIDEO_MODEL, safeImageToVideoModel } from '@/lib/ai/models';
import { snapDuration } from '@/lib/motion/motion-generation';
import { estimateVideoCost } from '@/lib/billing/cost-estimation';
import { multiplyMicros, usdToMicros } from '@/lib/billing/money';
import { requireCredits } from '@/lib/billing/preflight';
import { generateMotionSchema } from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { triggerWorkflow } from '@/lib/workflow/client';
import type {
  MergeVideoWorkflowInput,
  MotionWorkflowInput,
  MusicWorkflowInput,
} from '@/lib/workflow/types';

import { resolveMotionPrompt } from '@/lib/motion/resolve-motion-prompt';

import { frameAccessMiddleware, sequenceAccessMiddleware } from './middleware';
import { buildSceneSummaries } from './sequences';

// -- Generate Motion for Frame -------------------------------------------

const generateMotionInputSchema = generateMotionSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

export const generateFrameMotionFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateMotionInputSchema))
  .handler(async ({ data, context }) => {
    const { frame, sequence, teamId } = context;

    if (!frame.thumbnailUrl) {
      throw new Error('Frame has no thumbnail to generate motion from');
    }

    const model = safeImageToVideoModel(
      data.model || frame.motionModel || sequence.videoModel,
      DEFAULT_VIDEO_MODEL
    );

    const prompt = data.prompt || resolveMotionPrompt(frame, model);

    const duration = data.duration ?? snapDuration(undefined, model);

    await requireCredits(context.scopedDb, estimateVideoCost(model, duration), {
      errorMessage: 'Insufficient credits for motion generation',
    });

    const workflowInput: MotionWorkflowInput = {
      userId: context.user.id,
      teamId,
      frameId: frame.id,
      sequenceId: sequence.id,
      imageUrl: frame.thumbnailUrl,
      prompt,
      model,
      duration: data.duration,
      fps: data.fps,
      motionBucket: data.motionBucket,
      aspectRatio: sequence.aspectRatio,
    };

    const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
      deduplicationId: `motion-${frame.id}-${Date.now()}`,
    });

    return { workflowRunId, frameId: frame.id };
  });

// -- Batch Generate Motion for Sequence ----------------------------------

const batchGenerateMotionInputSchema = z.object({
  sequenceId: ulidSchema,
  includeMusic: z.boolean().optional(),
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

export const batchGenerateMotionFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(batchGenerateMotionInputSchema))
  .handler(async ({ data, context }) => {
    const { sequence, teamId, user } = context;

    const allFrames = await context.scopedDb.frames.listBySequence(sequence.id);
    // Server determines eligible frames: thumbnail done, video pending/failed
    const eligibleFrames = allFrames.filter(
      (f) =>
        f.thumbnailStatus === 'completed' &&
        f.thumbnailUrl &&
        (f.videoStatus === 'pending' || f.videoStatus === 'failed')
    );

    if (eligibleFrames.length === 0) {
      throw new Error('No eligible frames for motion generation');
    }

    const batchModel = data.model ?? DEFAULT_VIDEO_MODEL;
    const batchDuration = snapDuration(data.duration, batchModel);

    await requireCredits(
      context.scopedDb,
      multiplyMicros(
        estimateVideoCost(batchModel, batchDuration),
        eligibleFrames.length
      ),
      {
        errorMessage: `Insufficient credits for batch motion generation (${eligibleFrames.length} frames)`,
      }
    );

    const workflows: BatchMotionWorkflow[] = [];
    const errors: BatchMotionError[] = [];

    for (const frame of eligibleFrames) {
      try {
        if (!frame.thumbnailUrl) continue;

        const frameModel = safeImageToVideoModel(
          data.model || frame.motionModel || sequence.videoModel,
          DEFAULT_VIDEO_MODEL
        );

        const workflowInput: MotionWorkflowInput = {
          userId: user.id,
          teamId,
          frameId: frame.id,
          sequenceId: sequence.id,
          imageUrl: frame.thumbnailUrl,
          prompt: resolveMotionPrompt(frame, frameModel),
          model: frameModel,
          duration:
            data.duration || frame.metadata?.metadata?.durationSeconds || 3,
          fps: data.fps,
          motionBucket: data.motionBucket,
        };

        const workflowRunId = await triggerWorkflow('/motion', workflowInput, {
          deduplicationId: `motion-${frame.id}-${Date.now()}`,
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

    // Optionally trigger music generation
    let musicTriggered = false;
    if (data.includeMusic && sequence.musicStatus !== 'generating') {
      const effectivePrompt = sequence.musicPrompt;
      const effectiveTags = sequence.musicTags;

      const totalDuration = allFrames.reduce((sum, frame) => {
        const seconds = frame.durationMs
          ? frame.durationMs / 1000
          : (frame.metadata?.metadata?.durationSeconds ?? 10);
        return sum + seconds;
      }, 0);

      const baseInput = {
        userId: context.user.id,
        teamId: sequence.teamId,
        sequenceId: sequence.id,
        duration: totalDuration || 30,
      };

      const musicInput: MusicWorkflowInput =
        effectivePrompt && effectiveTags
          ? { ...baseInput, prompt: effectivePrompt, tags: effectiveTags }
          : { ...baseInput, scenes: buildSceneSummaries(allFrames) };

      try {
        await triggerWorkflow('/music', musicInput);
      } catch (error) {
        errors.push({
          frameId: 'music',
          error:
            error instanceof Error
              ? error.message
              : 'Failed to start music generation',
        });
      }
    }

    return {
      sequenceId: sequence.id,
      totalFrames: allFrames.length,
      eligibleFrames: eligibleFrames.length,
      workflowsStarted: workflows.length,
      workflows,
      musicTriggered,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

// -- Trigger Merge Video -------------------------------------------------

const mergeVideoInputSchema = z.object({
  sequenceId: ulidSchema,
});

export const triggerMergeVideoFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(mergeVideoInputSchema))
  .handler(async ({ context }) => {
    const { sequence, teamId, user } = context;

    const frames = await context.scopedDb.frames.listBySequence(sequence.id);

    if (frames.length === 0) {
      throw new Error('No frames found in sequence');
    }

    const incompleteCount = frames.filter(
      (f) => f.videoStatus !== 'completed' || !f.videoUrl
    ).length;

    if (incompleteCount > 0) {
      throw new Error(
        `${incompleteCount} frame(s) do not have completed videos`
      );
    }

    await requireCredits(context.scopedDb, usdToMicros(0.01), {
      errorMessage: 'Insufficient credits for video merge',
    });

    const videoUrls = frames
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((f) => f.videoUrl)
      .filter((url): url is string => Boolean(url));

    const workflowInput: MergeVideoWorkflowInput = {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      videoUrls,
    };

    const workflowRunId = await triggerWorkflow('/merge-video', workflowInput, {
      deduplicationId: `merge-${sequence.id}-${Date.now()}`,
    });

    return { workflowRunId, sequenceId: sequence.id };
  });
