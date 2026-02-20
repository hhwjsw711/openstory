/**
 * Merge Audio+Video Workflow
 * Muxes a music track onto the merged video to produce the final sequence output
 */

import { getDb } from '#db-client';
import { sequences } from '@/lib/db/schema';
import { composeAudioVideo } from '@/lib/audio/compose-audio-video';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
  uploadFile,
  STORAGE_BUCKETS,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import type {
  MergeAudioVideoWorkflowInput,
  MergeAudioVideoWorkflowResult,
} from '@/lib/workflow/types';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { eq } from 'drizzle-orm';

export const mergeAudioVideoWorkflow = createWorkflow(
  async (context: WorkflowContext<MergeAudioVideoWorkflowInput>) => {
    const input = context.requestPayload;

    if (!input.sequenceId) {
      throw new WorkflowValidationError('Sequence ID is required');
    }
    if (!input.mergedVideoUrl) {
      throw new WorkflowValidationError('Merged video URL is required');
    }
    if (!input.musicUrl) {
      throw new WorkflowValidationError('Music URL is required');
    }

    console.log(
      `[MergeAudioVideoWorkflow] Starting mux for sequence ${input.sequenceId}`
    );

    // Step 1: Set status to merging (reuse mergedVideoStatus to trigger UI polling)
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

    // Resolve team API keys
    const apiKeys = await context.run('resolve-api-keys', async () => {
      return resolveWorkflowApiKeys(input.teamId);
    });

    // Step 2: Compute actual video duration from frame data
    const videoDurationMs = await context.run(
      'compute-video-duration',
      async () => {
        const sequenceFrames = await getSequenceFrames(input.sequenceId);
        const totalMs = sequenceFrames.reduce(
          (sum, f) => sum + (f.durationMs ?? 3000),
          0
        );
        return totalMs;
      }
    );

    // Step 3: Compose video (preserving native audio) with music track via Fal FFmpeg compose API
    const muxResult = await context.run('compose-audio-video', async () => {
      return composeAudioVideo(
        input.mergedVideoUrl,
        input.musicUrl,
        videoDurationMs,
        apiKeys.falApiKey
      );
    });

    // Deduct credits
    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        teamId: input.teamId,
        costUsd: muxResult.cost,
        usedOwnKey: !!apiKeys.falApiKey,
        userId: input.userId,
        description: 'Audio+video mux',
        metadata: { sequenceId: input.sequenceId },
        workflowName: 'MergeAudioVideoWorkflow',
      });
    });

    // Step 3: Upload muxed video to R2 storage
    const storageResult = await context.run('upload-to-storage', async () => {
      const response = await fetch(muxResult.videoUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download muxed video: ${response.statusText}`
        );
      }

      const videoBlob = await response.blob();
      const extension = getExtensionFromUrl(muxResult.videoUrl) || 'mp4';
      const contentType = getMimeTypeFromExtension(extension);
      const shortHash = generateId().slice(-8);

      const path = `teams/${input.teamId}/sequences/${input.sequenceId}/merged/${shortHash}_velro.${extension}`;

      const result = await uploadFile(STORAGE_BUCKETS.VIDEOS, path, videoBlob, {
        contentType,
        upsert: true,
      });

      return { path, url: result.publicUrl };
    });

    // Step 4: Update sequence with muxed video (overwrites the video-only merge)
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
      `[MergeAudioVideoWorkflow] Completed mux for sequence ${input.sequenceId}`
    );

    const result: MergeAudioVideoWorkflowResult = {
      mergedVideoUrl: storageResult.url,
      mergedVideoPath: storageResult.path,
    };

    return result;
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
        `[MergeAudioVideoWorkflow] Failed to mux sequence ${input.sequenceId}: ${failResponse}`
      );

      return `Audio+video mux failed for sequence ${input.sequenceId}`;
    },
  }
);
