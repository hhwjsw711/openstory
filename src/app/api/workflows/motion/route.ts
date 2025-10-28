/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 */

import { serve } from '@upstash/workflow/nextjs';
import { LoggerService } from '@/lib/services/logger.service';
import type { MotionWorkflowInput, MotionWorkflowResult } from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import { db } from '@/lib/db/client';
import { frames } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateFrame } from '@/lib/db/helpers/frames';

const loggerService = new LoggerService('MotionWorkflow');

export const { POST } = serve<MotionWorkflowInput>(async (context) => {
  const input = context.requestPayload;

  // Validate authentication
  validateWorkflowAuth(input);

  loggerService.logDebug(
    `Starting motion generation workflow for frame ${input.frameId}`
  );

  // Step 1: Verify frame and get sequence/style info
  const frame = await context.run('verify-frame', async () => {
    const data = await db.query.frames.findFirst({
      where: eq(frames.id, input.frameId),
      with: {
        sequence: {
          columns: {
            id: true,
            teamId: true,
            styleId: true,
          },
          with: {
            style: {
              columns: {
                id: true,
                config: true,
              },
            },
          },
        },
      },
    });

    if (!data) {
      throw new Error(`Frame not found: ${input.frameId}`);
    }

    // Verify team authorization
    if (data.sequence.teamId !== input.teamId) {
      throw new Error('Unauthorized: Team ID mismatch');
    }

    return data;
  });

  // Step 2: Set status to generating
  await context.run('set-generating-status', async () => {
    await updateFrame(input.frameId, {
      videoStatus: 'generating',
      videoWorkflowRunId: context.workflowRunId,
    });
  });

  // Step 3: Generate motion/video
  const videoResult = await context.run('generate-motion', async () => {
    try {
      // Import motion service
      const { generateMotionForFrame } = await import(
        '@/lib/services/motion.service'
      );

      const result = await generateMotionForFrame({
        imageUrl: input.thumbnailUrl,
        prompt: input.prompt,
        model: input.model || 'veo3',
        duration: input.duration || 2,
        fps: input.fps || 7,
        motionBucket: input.motionBucket || 127,
        styleStack:
          (frame.sequence.style?.config as Record<string, unknown> | null) ||
          undefined,
      });

      if (!result.success || !result.videoUrl) {
        throw new Error(result.error || 'Motion generation failed');
      }

      return result;
    } catch (error) {
      loggerService.logError(
        `Motion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Update frame status on error
      await updateFrame(input.frameId, {
        videoStatus: 'failed',
        videoError: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });

  // Step 3: Upload video to storage
  const storageUrl = await context.run('upload-to-storage', async () => {
    if (!videoResult.videoUrl) {
      throw new Error('No video URL from generation step');
    }

    const { uploadVideoToStorage } = await import(
      '@/lib/services/video-storage.service'
    );

    const result = await uploadVideoToStorage({
      videoUrl: videoResult.videoUrl,
      teamId: input.teamId,
      sequenceId: input.sequenceId,
      frameId: input.frameId,
    });

    if (!result.success || !result.url) {
      throw new Error(result.error || 'Failed to upload video');
    }

    return result.url;
  });

  // Step 4: Update frame with video URL and status
  await context.run('update-frame', async () => {
    try {
      await updateFrame(input.frameId, {
        videoUrl: storageUrl,
        durationMs: (input.duration || 2) * 1000,
        videoStatus: 'completed',
        videoGeneratedAt: new Date(),
        videoError: null,
      });
    } catch (error) {
      throw new Error(
        `Failed to update frame: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  loggerService.logDebug('Motion generation workflow completed');

  // Return result
  const result: MotionWorkflowResult = {
    frameId: input.frameId,
    videoUrl: storageUrl,
    duration: input.duration || 2,
  };

  return result;
});
