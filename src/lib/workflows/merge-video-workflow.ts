/**
 * Merge Video Workflow
 * Stitches all frame videos into a single merged video for sequence playback
 */

import { getDb } from '#db-client';
import { sequences } from '@/lib/db/schema';
import { mergeVideos } from '@/lib/motion/merge-videos';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
  uploadFile,
  STORAGE_BUCKETS,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import type {
  MergeVideoWorkflowInput,
  MergeVideoWorkflowResult,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { eq } from 'drizzle-orm';

/**
 * Merge video workflow
 * Stitches all completed frame videos into a single merged video
 */
export const mergeVideoWorkflow = createWorkflow(
  async (context: WorkflowContext<MergeVideoWorkflowInput>) => {
    const input = context.requestPayload;

    // Validate required fields
    if (!input.sequenceId) {
      throw new WorkflowValidationError('Sequence ID is required');
    }

    if (!input.videoUrls || input.videoUrls.length === 0) {
      throw new WorkflowValidationError('At least one video URL is required');
    }

    console.log(
      `[MergeVideoWorkflow] Starting merge for sequence ${input.sequenceId} with ${input.videoUrls.length} videos`
    );

    // Step 1: Set status to merging
    await context.run('set-merging-status', async () => {
      await getDb()
        .update(sequences)
        .set({
          mergedVideoStatus: 'merging',
          mergedVideoError: null,
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, input.sequenceId));
    });

    // Step 2: Merge videos using fal.ai
    const mergeResult = await context.run('merge-videos', async () => {
      return mergeVideos(input.videoUrls, input.targetFps, input.resolution);
    });

    // Step 3: Upload merged video to R2 storage
    const storageResult = await context.run('upload-to-storage', async () => {
      // Download the merged video
      const response = await fetch(mergeResult.videoUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download merged video: ${response.statusText}`
        );
      }

      const videoBlob = await response.blob();
      const extension = getExtensionFromUrl(mergeResult.videoUrl) || 'mp4';
      const contentType = getMimeTypeFromExtension(extension);
      const shortHash = generateId().slice(-8);

      // Store in: teams/{teamId}/sequences/{sequenceId}/merged/{hash}_velro.{ext}
      const path = `teams/${input.teamId}/sequences/${input.sequenceId}/merged/${shortHash}_velro.${extension}`;

      const result = await uploadFile(STORAGE_BUCKETS.VIDEOS, path, videoBlob, {
        contentType,
        upsert: true,
      });

      return { path, url: result.publicUrl };
    });

    // Step 4: Update sequence with merged video
    await context.run('update-sequence', async () => {
      await getDb()
        .update(sequences)
        .set({
          mergedVideoUrl: storageResult.url,
          mergedVideoPath: storageResult.path,
          mergedVideoStatus: 'completed',
          mergedVideoGeneratedAt: new Date(),
          mergedVideoError: null,
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, input.sequenceId));
    });

    console.log(
      `[MergeVideoWorkflow] Completed merge for sequence ${input.sequenceId}`
    );

    const result: MergeVideoWorkflowResult = {
      mergedVideoUrl: storageResult.url,
      mergedVideoPath: storageResult.path,
    };

    return result;
  },
  {
    retries: 2,
    retryDelay: 'pow(2, retried) * 2000', // 2s, 4s, 8s
    flowControl: {
      key: 'fal-requests',
      parallelism: parseInt(process.env.FAL_CONCURRENCY_LIMIT || '10'),
    },
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Update sequence with failure status
      await getDb()
        .update(sequences)
        .set({
          mergedVideoStatus: 'failed',
          mergedVideoError: String(failResponse),
          updatedAt: new Date(),
        })
        .where(eq(sequences.id, input.sequenceId));

      console.error(
        `[MergeVideoWorkflow] Failed to merge sequence ${input.sequenceId}: ${failResponse}`
      );

      return `Merge failed for sequence ${input.sequenceId}`;
    },
  }
);
