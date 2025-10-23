/**
 * Motion generation workflow
 * Generates video motion from static frame thumbnails (image-to-video)
 */

import { serve } from '@upstash/workflow/nextjs';
import { LoggerService } from '@/lib/services/logger.service';
import { createAdminClient } from '@/lib/supabase/server';
import type { MotionWorkflowInput, MotionWorkflowResult } from '@/lib/workflow';
import { validateWorkflowAuth } from '@/lib/workflow';
import type { Json } from '@/types/database';

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
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('frames')
      .select('*, sequences!inner(team_id, style_id, styles(config))')
      .eq('id', input.frameId)
      .single();

    if (error || !data) {
      throw new Error(`Frame not found: ${input.frameId}`);
    }

    // Verify team authorization
    if (data.sequences.team_id !== input.teamId) {
      throw new Error('Unauthorized: Team ID mismatch');
    }

    return data;
  });

  // Step 2: Generate motion/video
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
        styleStack: frame.sequences.styles?.config as Json | undefined,
      });

      if (!result.success || !result.videoUrl) {
        throw new Error(result.error || 'Motion generation failed');
      }

      return result;
    } catch (error) {
      loggerService.logError(
        `Motion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Update frame metadata on error
      const supabase = createAdminClient();
      await supabase
        .from('frames')
        .update({
          metadata: {
            ...(frame.metadata as Record<string, unknown>),
            motionStatus: 'failed',
            motionError:
              error instanceof Error ? error.message : 'Unknown error',
            motionFailedAt: new Date().toISOString(),
          } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.frameId);

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

  // Step 4: Update frame with video URL and metadata
  await context.run('update-frame', async () => {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('frames')
      .update({
        video_url: storageUrl,
        duration_ms: (input.duration || 2) * 1000,
        metadata: {
          ...(frame.metadata as Record<string, unknown>),
          motionStatus: 'completed',
          motionModel: input.model || 'veo3',
          motionGeneratedAt: new Date().toISOString(),
          motionMetadata: videoResult.metadata,
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.frameId);

    if (error) {
      throw new Error(`Failed to update frame: ${error.message}`);
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
