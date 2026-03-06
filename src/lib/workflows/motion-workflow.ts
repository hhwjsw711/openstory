/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 */

import { DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import { isBillingEnabled } from '@/lib/billing/constants';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import {
  getFrameWithSequence,
  getSequenceFrames,
  updateFrame,
} from '@/lib/db/helpers/frames';
import { generateMotionForFrame } from '@/lib/motion/motion-generation';
import { uploadVideoToStorage } from '@/lib/motion/video-storage';
import { getGenerationChannel } from '@/lib/realtime';
import { triggerWorkflow } from '@/lib/workflow/client';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type {
  MergeVideoWorkflowInput,
  MotionWorkflowInput,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

export const generateMotionWorkflow = createWorkflow(
  async (context: WorkflowContext<MotionWorkflowInput>) => {
    const input = context.requestPayload;
    const model = input.model || DEFAULT_VIDEO_MODEL;

    if (!input.imageUrl?.trim()) {
      throw new WorkflowValidationError(
        'Thumbnail Path is required for motion generation'
      );
    }

    // Step 1: Set status to generating and store model being used
    const { frameDeleted } = await context.run(
      'set-generating-status',
      async () => {
        if (!input.frameId) return { frameDeleted: false };

        const frame = await updateFrame(
          input.frameId,
          {
            videoStatus: 'generating',
            videoWorkflowRunId: context.workflowRunId,
            motionModel: model,
            motionPrompt: input.prompt,
          },
          { throwOnMissing: false }
        );

        if (!frame) {
          console.log(
            `[MotionWorkflow] Frame ${input.frameId} was deleted, skipping workflow`
          );
          return { frameDeleted: true };
        }

        void getGenerationChannel(input.sequenceId).emit(
          'generation.video:progress',
          { frameId: input.frameId, status: 'generating' }
        );
        return { frameDeleted: false };
      }
    );

    if (frameDeleted) {
      return { videoUrl: '', duration: 0 };
    }

    // Step 2: Generate motion/video
    const videoResult = await context.run('generate-motion', async () => {
      const result = await generateMotionForFrame({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        model,
        duration: input.duration,
        fps: input.fps,
        motionBucket: input.motionBucket,
        aspectRatio: input.aspectRatio,
        traceName: 'frame-motion',
        teamId: input.teamId,
      });

      if (!result.success || !result.videoUrl) {
        throw new Error(result.error || 'Motion generation failed');
      }

      return result;
    });

    const actualDuration =
      typeof videoResult.metadata?.duration === 'number'
        ? videoResult.metadata.duration
        : (input.duration ?? 2);

    // Deduct credits (skip if team used own fal key)
    const motionCost =
      typeof videoResult.metadata?.cost === 'number'
        ? videoResult.metadata.cost
        : 0;
    const { teamId } = input;
    if (
      isBillingEnabled() &&
      motionCost > 0 &&
      teamId &&
      !videoResult.metadata.usedOwnKey
    ) {
      await context.run('deduct-credits', async () => {
        const canAfford = await hasEnoughCredits(teamId, motionCost);
        if (!canAfford) {
          console.warn(
            `[MotionWorkflow] Insufficient credits for team ${teamId} (cost: $${motionCost.toFixed(4)}), skipping deduction`
          );
          return;
        }
        await deductCredits(teamId, motionCost, {
          userId: input.userId,
          description: `Motion generation (${model})`,
          metadata: {
            model,
            frameId: input.frameId,
            sequenceId: input.sequenceId,
            duration: videoResult.metadata?.duration,
          },
        });
      });
    }

    if (!videoResult.videoUrl) {
      throw new Error('Video URL missing from generation result');
    }
    let videoUrl = videoResult.videoUrl;

    if (input.frameId) {
      const { frameId } = input;

      // Step 3: Fetch frame and sequence data for human-readable filename
      const frameData = await context.run('fetch-frame-data', async () => {
        const frame = await getFrameWithSequence(frameId);
        if (!frame) throw new Error('Frame not found');
        return {
          sequenceTitle: frame.sequence.title,
          sceneTitle: frame.metadata?.metadata?.title,
        };
      });

      // Step 4: Upload video to storage
      const storageResult = await context.run('upload-to-storage', async () => {
        if (!input.teamId || !input.sequenceId) {
          throw new Error('Missing teamId or sequenceId for storage upload');
        }

        const result = await uploadVideoToStorage({
          videoUrl,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          frameId,
          sequenceTitle: frameData.sequenceTitle,
          sceneTitle: frameData.sceneTitle,
        });

        if (!result.success) {
          throw new Error('Failed to upload video');
        }

        return { path: result.path, url: result.url };
      });

      videoUrl = storageResult.url;

      // Step 5: Update frame with video path, URL, and status
      await context.run('update-frame', async () => {
        const updatedFrame = await updateFrame(
          frameId,
          {
            videoPath: storageResult.path,
            videoUrl: storageResult.url,
            durationMs: actualDuration * 1000,
            videoStatus: 'completed',
            videoGeneratedAt: new Date(),
            videoError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            `[MotionWorkflow] Frame ${frameId} was deleted, skipping final update`
          );
          return;
        }

        void getGenerationChannel(input.sequenceId).emit(
          'generation.video:progress',
          { frameId, status: 'completed', videoUrl: storageResult.url }
        );
      });

      // Step 6: Check if all frames are complete and trigger merge
      // TODO: Tom Dec 2025 - I don't love this. It's a bit of a hack.
      // I looked at multiple options and the only way to reliably do this is to have versioning.
      // This should be replaced once that is in place
      await context.run('check-merge-trigger', async () => {
        if (!input.sequenceId || !input.teamId || !input.userId) return;

        const allFrames = await getSequenceFrames(input.sequenceId);
        if (allFrames.length === 0) return;
        if (!allFrames.every((f) => f.videoStatus === 'completed')) return;

        const videoUrls = allFrames
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((f) => f.videoUrl)
          .filter((url): url is string => Boolean(url));

        if (videoUrls.length !== allFrames.length) return;

        console.log(
          `[MotionWorkflow] All ${allFrames.length} frames complete, triggering merge workflow`
        );

        const mergeInput: MergeVideoWorkflowInput = {
          userId: input.userId,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          videoUrls,
        };

        await triggerWorkflow('/merge-video', mergeInput, {
          deduplicationId: `merge-${input.sequenceId}-${Date.now()}`,
        });
      });
    }

    console.log('[MotionWorkflow] Motion generation workflow completed');
    return { videoUrl, duration: actualDuration };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;
      if (input.frameId) {
        await updateFrame(
          input.frameId,
          {
            videoStatus: 'failed',
            videoError: failResponse,
          },
          { throwOnMissing: false }
        );
      }

      if (input.sequenceId && input.frameId) {
        try {
          void getGenerationChannel(input.sequenceId).emit(
            'generation.video:progress',
            { frameId: input.frameId, status: 'failed' }
          );
        } catch {
          // Ignore emit errors in failure handler
        }
      }

      console.error(
        `[MotionWorkflow] Motion generation failed for frame ${input.frameId}: ${failResponse}`
      );

      return `Motion generation failed for frame ${input.frameId}`;
    },
  }
);
