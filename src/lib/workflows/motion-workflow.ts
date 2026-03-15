/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 *
 * Uses batched polling: each context.run polls in a tight loop for ~30s,
 * then checkpoints via context.sleep between batches for durability.
 * This reduces QStash steps by ~10x vs one-step-per-poll.
 */

import { DEFAULT_VIDEO_MODEL, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { micros, microsToUsd } from '@/lib/billing/money';
import {
  getFrameWithSequence,
  getSequenceFrames,
  updateFrame,
} from '@/lib/db/helpers/frames';
import { ensureImageUnderLimit } from '@/lib/image/image-compress';
import { uploadImageBufferToStorage } from '@/lib/image/image-storage';
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

/** Each batch polls in a tight loop for ~30s, then checkpoints for durability */
const POLL_BATCH_DURATION_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;
/** 30 batches × 30s = 15 minutes total timeout */
const MAX_BATCHES = 30;
/** Kling rejects start frame images over 10MB — use 9.5MB safety margin */
const KLING_MAX_IMAGE_BYTES = 9.5 * 1024 * 1024;

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

    // Step 2: Prepare start image — compress if Kling model and image exceeds 10MB
    const startImageUrl = await context.run('prepare-start-image', async () => {
      const modelConfig = IMAGE_TO_VIDEO_MODELS[model];
      if (modelConfig.provider !== 'kling') {
        return input.imageUrl;
      }

      const compressed = await ensureImageUnderLimit(
        input.imageUrl,
        KLING_MAX_IMAGE_BYTES
      );
      if (!compressed) {
        return input.imageUrl;
      }

      if (!input.teamId || !input.sequenceId || !input.frameId) {
        console.warn(
          '[MotionWorkflow] Missing storage context, using original image URL'
        );
        return input.imageUrl;
      }

      const result = await uploadImageBufferToStorage({
        imageBuffer: compressed.buffer,
        teamId: input.teamId,
        sequenceId: input.sequenceId,
        frameId: input.frameId,
        contentType: compressed.contentType,
      });

      console.log(
        `[MotionWorkflow] Compressed start image: ${(compressed.originalSizeBytes / 1024 / 1024).toFixed(1)}MB → ${(compressed.compressedSizeBytes / 1024 / 1024).toFixed(1)}MB`
      );

      return result.url;
    });

    // Step 3a: Submit the motion generation job
    const job = await context.run('submit-motion', async () => {
      return submitMotionJob({
        imageUrl: startImageUrl,
        prompt: input.prompt,
        model,
        duration: input.duration,
        fps: input.fps,
        motionBucket: input.motionBucket,
        aspectRatio: input.aspectRatio,
        teamId: input.teamId,
      });
    });

    // Step 3b: Batched polling — tight loop inside each context.run, checkpoint between batches
    let videoUrl = '';

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      if (batch > 0) {
        await context.sleep(`motion-batch-wait-${batch}`, 1);
      }

      const poll = await context.run(`motion-poll-batch-${batch}`, async () => {
        const deadline = Date.now() + POLL_BATCH_DURATION_MS;

        while (Date.now() < deadline) {
          const result = await pollMotionJob(
            job.jobId,
            job.modelKey,
            input.teamId
          );

          if (result.progress !== undefined) {
            console.log(`[MotionWorkflow] Progress: ${result.progress}%`);
          }

          if (result.status === 'completed' && result.videoUrl) {
            console.log(`[MotionWorkflow] Generation completed`);
            return result;
          }

          if (result.status === 'failed') {
            return result;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        return { status: 'pending' as const };
      });

      if (poll.status === 'completed' && 'videoUrl' in poll && poll.videoUrl) {
        videoUrl = poll.videoUrl;
        break;
      }

      if (poll.status === 'failed') {
        throw new Error(
          ('error' in poll && poll.error) || 'Motion generation failed'
        );
      }
    }

    if (!videoUrl) {
      throw new Error('Motion generation timed out after 15 minutes');
    }

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
    if (motionCostMicros > 0 && teamId && !job.usedOwnKey) {
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
