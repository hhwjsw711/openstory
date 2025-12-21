/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 */

import { getFrameWithSequence, updateFrame } from '@/lib/db/helpers/frames';
import type { Scene } from '@/lib/ai/scene-analysis.schema';
import { getGenerationChannel } from '@/lib/realtime';
import type { MotionWorkflowInput, MotionWorkflowResult } from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
// Import motion service
import { generateMotionForFrame } from '@/lib/motion/motion-generation';
import { uploadVideoToStorage } from '@/lib/motion/video-storage';
import { DEFAULT_VIDEO_MODEL } from '@/lib/ai/models';

const maxDuration = 800; // This function can run for a maximum of 800 seconds

/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 * @param context - The workflow context. Input is in the request payload.
 * - userId: string;
 * - teamId: string;
 * - frameId: string;
 * - sequenceId: string;
 * - thumbnailUrl: string;
 * - prompt?: string;
 * - model?: keyof typeof IMAGE_TO_VIDEO_MODELS;
 * - duration?: number;
 * - fps?: number;
 * - motionBucket?: number;
 * @param  - The motion workflow input
 * @returns The motion workflow result
 * @throws WorkflowValidationError if the thumbnail URL is required for motion generation
 * @throws WorkflowValidationError if the team ID is not authorized
 * @throws WorkflowValidationError if the frame is not found
 * @throws WorkflowValidationError if the frame is not authorized
 * @throws WorkflowValidationError if the frame is not found
 */
export const generateMotionWorkflow = createWorkflow(
  async (context: WorkflowContext<MotionWorkflowInput>) => {
    const input = context.requestPayload;

    // Get realtime channel for streaming progress (if available)

    // Helper to safely emit events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emit = async (event: string, data: any) => {
      if (!input.sequenceId) return;
      const channel = getGenerationChannel(input.sequenceId);
      if (!channel) return;
      try {
        await channel.emit(
          `generation.${event}` as 'generation.complete',
          data
        );
      } catch {
        // Ignore emit errors - don't fail the workflow
      }
    };

    // Validate required fields
    if (!input.imageUrl || input.imageUrl.trim().length === 0) {
      throw new WorkflowValidationError(
        'Thumbnail Path is required for motion generation'
      );
    }

    // Step 1: Verify frame and get sequence/style info
    let frameDeleted = false;
    if (input.frameId) {
      // Step 2: Set status to generating and store model being used
      await context.run('set-generating-status', async () => {
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
            frameDeleted = true;
            return;
          }

          // Emit realtime progress
          await emit('video:progress', {
            frameId: input.frameId,
            status: 'generating',
          });
        }
      });
    }

    // Early exit if frame was deleted
    if (frameDeleted) {
      return { videoUrl: '', duration: 0 };
    }

    // Step 2: Generate motion/video
    const videoResult = await context.run('generate-motion', async () => {
      // Select appropriate image URL based on environment
      // - Local dev: Use temporary FAL URL (publicly accessible)
      // - Production: Generate signed URL from R2 storage path
      const imageUrl = input.imageUrl;

      if (!imageUrl) {
        throw new Error(
          'No accessible image URL available for motion generation'
        );
      }

      const result = await generateMotionForFrame({
        imageUrl,
        prompt: input.prompt,
        model: input.model || DEFAULT_VIDEO_MODEL,
        duration: input.duration,
        fps: input.fps,
        motionBucket: input.motionBucket,
        aspectRatio: input.aspectRatio,
      });

      if (!result.success || !result.videoUrl) {
        throw new Error(result.error || 'Motion generation failed');
      }

      return result;
    });

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

        // Use actual duration from motion generation metadata
        const metadataDuration =
          typeof videoResult.metadata?.duration === 'number'
            ? videoResult.metadata.duration
            : null;
        const actualDuration = metadataDuration ?? input.duration ?? 2;

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
        await emit('video:progress', {
          frameId: input.frameId,
          status: 'completed',
          videoUrl: storageResult.url,
        });
      });
    }
    console.log('[MotionWorkflow]', 'Motion generation workflow completed');

    // Return result
    const metadataDuration =
      typeof videoResult.metadata?.duration === 'number'
        ? videoResult.metadata.duration
        : null;
    const actualDuration = metadataDuration ?? input.duration ?? 2;
    const result: MotionWorkflowResult = {
      videoUrl, // Return signed URL for backward compatibility
      duration: actualDuration,
    };

    return result;
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    flowControl: {
      key: 'fal-requests', // Shared key for both image & motion
      parallelism: parseInt(process.env.FAL_CONCURRENCY_LIMIT || '10'),
    },
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
      if (input.sequenceId) {
        try {
          const channel = getGenerationChannel(input.sequenceId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (channel.emit as any)('generation.video:progress', {
            frameId: input.frameId,
            status: 'failed',
          });
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
