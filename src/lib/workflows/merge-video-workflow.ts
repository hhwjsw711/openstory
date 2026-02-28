/**
 * Merge Video Workflow
 * Stitches all frame videos into a single merged video for sequence playback
 */

import { getDb } from '#db-client';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { uploadFile } from '#storage';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { generateId } from '@/lib/db/id';
import { sequences } from '@/lib/db/schema';
import { mergeVideos } from '@/lib/motion/merge-videos';
import { triggerWorkflow } from '@/lib/workflow/client';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type {
  MergeAudioVideoWorkflowInput,
  MergeVideoWorkflowInput,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { eq } from 'drizzle-orm';

/** If music is already completed, trigger the audio+video mux workflow. */
async function triggerMuxIfMusicReady(
  input: MergeVideoWorkflowInput,
  mergedVideoUrl: string
): Promise<void> {
  const [seq] = await getDb()
    .select({
      musicStatus: sequences.musicStatus,
      musicUrl: sequences.musicUrl,
    })
    .from(sequences)
    .where(eq(sequences.id, input.sequenceId));

  if (seq?.musicStatus !== 'completed' || !seq.musicUrl) return;

  console.log(
    `[MergeVideoWorkflow] Video + music both ready, triggering mux for sequence ${input.sequenceId}`
  );

  const muxInput: MergeAudioVideoWorkflowInput = {
    userId: input.userId,
    teamId: input.teamId,
    sequenceId: input.sequenceId,
    mergedVideoUrl,
    musicUrl: seq.musicUrl,
  };

  await triggerWorkflow('/merge-audio-video', muxInput);
}

export const mergeVideoWorkflow = createWorkflow(
  async (context: WorkflowContext<MergeVideoWorkflowInput>) => {
    const input = context.requestPayload;

    if (!input.sequenceId) {
      throw new WorkflowValidationError('Sequence ID is required');
    }
    if (!input.videoUrls || input.videoUrls.length === 0) {
      throw new WorkflowValidationError('At least one video URL is required');
    }

    console.log(
      `[MergeVideoWorkflow] Starting merge for sequence ${input.sequenceId} with ${input.videoUrls.length} videos`
    );

    // Single video: skip merge, use existing video directly
    if (input.videoUrls.length === 1) {
      const singleUrl = input.videoUrls[0];

      await context.run('update-sequence-single', async () => {
        await getDb()
          .update(sequences)
          .set({
            mergedVideoUrl: singleUrl,
            mergedVideoPath: null,
            mergedVideoStatus: 'completed',
            mergedVideoGeneratedAt: new Date(),
            mergedVideoError: null,
            updatedAt: new Date(),
          })
          .where(eq(sequences.id, input.sequenceId));
      });

      await context.run('check-mux-trigger-single', async () => {
        await triggerMuxIfMusicReady(input, singleUrl);
      });

      return { mergedVideoUrl: singleUrl, mergedVideoPath: null };
    }

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

    const mergeResult = await context.run('merge-videos', async () => {
      return mergeVideos(input);
    });

    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        teamId: input.teamId,
        costUsd: mergeResult.cost,
        usedOwnKey: mergeResult.metadata.usedOwnKey,
        userId: input.userId,
        description: `Video merge (${input.videoUrls.length} clips)`,
        metadata: { sequenceId: input.sequenceId },
        workflowName: 'MergeVideoWorkflow',
      });
    });

    const storageResult = await context.run('upload-to-storage', async () => {
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
      const path = `teams/${input.teamId}/sequences/${input.sequenceId}/merged/${shortHash}_velro.${extension}`;

      const result = await uploadFile(STORAGE_BUCKETS.VIDEOS, path, videoBlob, {
        contentType,
        upsert: true,
      });

      return { path, url: result.publicUrl };
    });

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

    await context.run('check-mux-trigger', async () => {
      await triggerMuxIfMusicReady(input, storageResult.url);
    });

    console.log(
      `[MergeVideoWorkflow] Completed merge for sequence ${input.sequenceId}`
    );

    return {
      mergedVideoUrl: storageResult.url,
      mergedVideoPath: storageResult.path,
    };
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

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
