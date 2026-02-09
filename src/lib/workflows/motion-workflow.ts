/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 */

import {
  getFrameWithSequence,
  getSequenceFrames,
  updateFrame,
} from '@/lib/db/helpers/frames';
import { triggerWorkflow } from '@/lib/workflow/client';
import type {
  MergeVideoWorkflowInput,
  MotionWorkflowInput,
} from '@/lib/workflow/types';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { generateMotionForFrame } from '@/lib/motion/motion-generation';
import { uploadVideoToStorage } from '@/lib/motion/video-storage';
import { DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';
import { getFalFlowControl } from './constants';

export const generateMotionWorkflow = createWorkflow(
  async (context: WorkflowContext<MotionWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate required fields
    if (!input.imageUrl || input.imageUrl.trim().length === 0) {
      throw new WorkflowValidationError(
        'Thumbnail Path is required for motion generation'
      );
    }

    // Step 1: Set status to generating and store model being used
    const { frameDeleted } = await context.run(
      'set-generating-status',
      async () => {
        if (input.frameId) {
          const frame = await updateFrame(
            input.frameId,
            {
              videoStatus: 'generating',
              videoWorkflowRunId: context.workflowRunId,
              motionModel: input.model || DEFAULT_VIDEO_MODEL,
              motionPrompt: input.prompt,
            },
            { throwOnMissing: false }
          );

          if (!frame) {
            console.log(
              '[MotionWorkflow]',
              `Frame ${input.frameId} was deleted, skipping workflow`
            );
            return { frameDeleted: true };
          }

          // Emit realtime progress
          await getGenerationChannel(input.sequenceId).emit(
            'generation.video:progress',
            {
              frameId: input.frameId,
              status: 'generating',
            }
          );
        }
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
        model: input.model || DEFAULT_VIDEO_MODEL,
        duration: input.duration,
        fps: input.fps,
        motionBucket: input.motionBucket,
        aspectRatio: input.aspectRatio,
        traceName: 'frame-motion',
      });

      if (!result.success || !result.videoUrl) {
        throw new Error(result.error || 'Motion generation failed');
      }

      return result;
    });

    // Resolve duration once from metadata or input defaults
    const actualDuration =
      typeof videoResult.metadata?.duration === 'number'
        ? videoResult.metadata.duration
        : (input.duration ?? 2);

    // Deduct credits for motion generation
    const motionCost =
      typeof videoResult.metadata?.cost === 'number'
        ? videoResult.metadata.cost
        : 0;
    const model = input.model || DEFAULT_VIDEO_MODEL;
    const { teamId } = input;
    if (motionCost > 0 && teamId) {
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

    let videoUrl: string = videoResult.videoUrl || '';

    if (input.frameId) {
      // Step 3: Fetch frame and sequence data for human-readable filename
      const frameData = await context.run('fetch-frame-data', async () => {
        if (!input.frameId) throw new Error('Frame ID required');
        const frame = await getFrameWithSequence(input.frameId);
        if (!frame) throw new Error('Frame not found');
        return {
          sequenceTitle: frame.sequence.title,
          sceneTitle: frame.metadata?.metadata?.title,
        };
      });

      // Step 4: Upload video to storage with human-readable filename
      const storageResult = await context.run('upload-to-storage', async () => {
        if (
          !videoResult.videoUrl ||
          !input.teamId ||
          !input.sequenceId ||
          !input.frameId
        ) {
          throw new Error('Missing required IDs for storage upload', {
            cause: JSON.stringify(videoResult),
          });
        }

        const result = await uploadVideoToStorage({
          videoUrl: videoResult.videoUrl,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          frameId: input.frameId,
          sequenceTitle: frameData.sequenceTitle,
          sceneTitle: frameData.sceneTitle,
        });

        if (!result.success || !result.path) {
          throw new Error('Failed to upload video');
        }

        return { path: result.path, url: result.url };
      });

      videoUrl = storageResult.url;
      // Step 5: Update frame with video path, URL, and status
      await context.run('update-frame', async () => {
        if (!videoUrl || !input.teamId || !input.sequenceId || !input.frameId) {
          throw new Error('Missing required IDs for storage upload', {
            cause: JSON.stringify(videoResult),
          });
        }

        const updatedFrame = await updateFrame(
          input.frameId,
          {
            videoPath: storageResult.path, // Store R2 path (permanent)
            videoUrl: storageResult.url, // Store public URL (permanent, not signed)
            durationMs: actualDuration * 1000,
            videoStatus: 'completed',
            videoGeneratedAt: new Date(),
            videoError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[MotionWorkflow]',
            `Frame ${input.frameId} was deleted, skipping final update`
          );
          return;
        }

        // Emit completion progress
        await getGenerationChannel(input.sequenceId).emit(
          'generation.video:progress',
          {
            frameId: input.frameId,
            status: 'completed',
            videoUrl: storageResult.url,
          }
        );
      });

      // Step 6: Check if all frames are complete and trigger merge
      // TODO: Tom Dec 2025 - I don't love this. It's a bit of a hack.
      // I looked at multiple options and the only way to reliably do this is to have versioning.
      // This should be replaced once that is in place
      await context.run('check-merge-trigger', async () => {
        if (!input.sequenceId || !input.teamId || !input.userId) return;

        const allFrames = await getSequenceFrames(input.sequenceId);
        const allComplete = allFrames.every(
          (f) => f.videoStatus === 'completed'
        );

        if (allComplete && allFrames.length > 0) {
          const videoUrls = allFrames
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((f) => f.videoUrl)
            .filter((url): url is string => Boolean(url));

          if (videoUrls.length === allFrames.length) {
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
              deduplicationId: `merge-${input.sequenceId}`,
            });
          }
        }
      });
    }
    console.log('[MotionWorkflow]', 'Motion generation workflow completed');

    return { videoUrl, duration: actualDuration };
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    flowControl: getFalFlowControl(),
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

      // Emit failure progress
      if (input.sequenceId && input.frameId) {
        try {
          await getGenerationChannel(input.sequenceId).emit(
            'generation.video:progress',
            {
              frameId: input.frameId,
              status: 'failed',
            }
          );
        } catch {
          // Ignore emit errors
        }
      }

      console.error(
        '[MotionWorkflow]',
        `Motion generation failed for frame ${input.frameId}: ${failResponse}`
      );

      return `Motion generation failed for frame ${input.frameId}`;
    },
  }
);
