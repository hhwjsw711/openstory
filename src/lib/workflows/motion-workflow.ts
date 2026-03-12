/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 *
 * Uses durable polling via context.sleep() so each poll is a separate
 * workflow step — avoids Vite/HTTP server timeouts during long generation.
 */

import { DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import { isBillingEnabled } from '@/lib/billing/constants';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { micros, microsToUsd } from '@/lib/billing/money';
import {
  getFrameWithSequence,
  getSequenceFrames,
  updateFrame,
} from '@/lib/db/helpers/frames';
import {
  calculateMotionMetadata,
  pollMotionJob,
  submitMotionJob,
} from '@/lib/motion/motion-generation';
import { uploadVideoToStorage } from '@/lib/motion/video-storage';
import { getGenerationChannel } from '@/lib/realtime';
import { triggerWorkflow } from '@/lib/workflow/client';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import type {
  MergeVideoWorkflowInput,
  MotionWorkflowInput,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

/** Max polls × sleep seconds = total timeout (15 minutes * 20 polls per minute = 300 polls) */
const MAX_POLLS = 15 * 20;
const POLL_INTERVAL_SECONDS = 3;

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

    // Step 2a: Submit the motion generation job
    const job = await context.run('submit-motion', async () => {
      return submitMotionJob({
        imageUrl: input.imageUrl,
        prompt: input.prompt,
        model,
        duration: input.duration,
        fps: input.fps,
        motionBucket: input.motionBucket,
        aspectRatio: input.aspectRatio,
        teamId: input.teamId,
      });
    });

    // Step 2b: Poll for completion with durable sleep between steps
    let videoUrl = await (async (): Promise<string> => {
      for (let i = 0; i < MAX_POLLS; i++) {
        await context.sleep(`motion-wait-${i}`, POLL_INTERVAL_SECONDS);

        const poll = await context.run(`motion-poll-${i}`, async () => {
          return pollMotionJob(job.jobId, job.modelKey, input.teamId);
        });

        if (poll.status === 'completed' && poll.videoUrl) {
          console.log(`[MotionWorkflow] Generation completed`);
          return poll.videoUrl;
        }

        if (poll.status === 'failed') {
          throw new Error(poll.error || 'Motion generation failed');
        }

        if (poll.progress !== undefined) {
          console.log(`[MotionWorkflow] Progress: ${poll.progress}%`);
        }
      }

      throw new Error('Motion generation timed out after 10 minutes');
    })();
    // Calculate cost + metadata
    const motionMeta = calculateMotionMetadata({
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      model,
      duration: input.duration,
      fps: input.fps,
      motionBucket: input.motionBucket,
      aspectRatio: input.aspectRatio,
    });

    const actualDuration = motionMeta.duration;

    // Deduct credits (skip if team used own fal key)
    const motionCostMicros = micros(motionMeta.cost);
    const { teamId } = input;
    if (
      isBillingEnabled() &&
      motionCostMicros > 0 &&
      teamId &&
      !job.usedOwnKey
    ) {
      await context.run('deduct-credits', async () => {
        const canAfford = await hasEnoughCredits(teamId, motionCostMicros);
        if (!canAfford) {
          console.warn(
            `[MotionWorkflow] Insufficient credits for team ${teamId} (cost: $${microsToUsd(motionCostMicros).toFixed(4)}), skipping deduction`
          );
          return;
        }
        await deductCredits(teamId, motionCostMicros, {
          userId: input.userId,
          description: `Motion generation (${model})`,
          metadata: {
            model,
            frameId: input.frameId,
            sequenceId: input.sequenceId,
            duration: motionMeta.duration,
          },
        });
      });
    }

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
      const error = sanitizeFailResponse(failResponse);
      if (input.frameId) {
        await updateFrame(
          input.frameId,
          {
            videoStatus: 'failed',
            videoError: error,
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
        `[MotionWorkflow] Motion generation failed for frame ${input.frameId}: ${error}`
      );

      return `Motion generation failed for frame ${input.frameId}`;
    },
  }
);
