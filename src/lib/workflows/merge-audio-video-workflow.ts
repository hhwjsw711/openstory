/**
 * Merge Audio+Video Workflow
 * Muxes a music track onto the merged video to produce the final sequence output
 */

import { composeAudioVideo } from '@/lib/audio/compose-audio-video';
import { usdToMicros } from '@/lib/billing/money';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { generateId } from '@/lib/db/id';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { uploadResponse } from '@/lib/storage/upload-response';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type { MergeAudioVideoWorkflowInput } from '@/lib/workflow/types';

export const mergeAudioVideoWorkflow = createScopedWorkflow<
  MergeAudioVideoWorkflowInput,
  { mergedVideoUrl: string; mergedVideoPath: string }
>(
  async (context, scopedDb) => {
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
    const seq = scopedDb.sequence(input.sequenceId);

    console.log(
      `[MergeAudioVideoWorkflow] Starting mux for sequence ${input.sequenceId}`
    );

    await context.run('set-merging-status', async () => {
      await seq.updateMergedVideoFields({
        mergedVideoStatus: 'merging',
        mergedVideoError: null,
      });
    });

    const videoDurationMs = await context.run(
      'compute-video-duration',
      async () => {
        const frames = await scopedDb.frames.listBySequence(input.sequenceId);
        return frames.reduce((sum, f) => sum + (f.durationMs ?? 3000), 0);
      }
    );

    const muxResult = await context.run('compose-audio-video', async () => {
      return composeAudioVideo({
        videoUrl: input.mergedVideoUrl,
        musicUrl: input.musicUrl,
        durationMs: videoDurationMs,
        scopedDb,
      });
    });

    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        scopedDb,
        costMicros: usdToMicros(muxResult.cost),
        usedOwnKey: muxResult.usedOwnKey,
        userId: input.userId,
        description: 'Audio+video mux',
        metadata: { sequenceId: input.sequenceId },
        workflowName: 'MergeAudioVideoWorkflow',
      });
    });

    const storageResult = await context.run('upload-to-storage', async () => {
      const response = await fetch(muxResult.videoUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download muxed video: ${response.statusText}`
        );
      }

      const extension = getExtensionFromUrl(muxResult.videoUrl) || 'mp4';
      const contentType = getMimeTypeFromExtension(extension);
      const shortHash = generateId().slice(-8);
      const path = `teams/${input.teamId}/sequences/${input.sequenceId}/merged/${shortHash}_openstory.${extension}`;

      const result = await uploadResponse(
        response,
        STORAGE_BUCKETS.VIDEOS,
        path,
        {
          contentType,
        }
      );

      return { path, url: result.publicUrl };
    });

    await context.run('update-sequence', async () => {
      await seq.updateMergedVideoFields({
        mergedVideoUrl: storageResult.url,
        mergedVideoPath: storageResult.path,
        mergedVideoStatus: 'completed',
        mergedVideoGeneratedAt: new Date(),
        mergedVideoError: null,
      });
    });

    console.log(
      `[MergeAudioVideoWorkflow] Completed mux for sequence ${input.sequenceId}`
    );

    return {
      mergedVideoUrl: storageResult.url,
      mergedVideoPath: storageResult.path,
    };
  },
  {
    failureFunction: async ({ context, scopedDb, failResponse }) => {
      const input = context.requestPayload;
      const error = sanitizeFailResponse(failResponse);
      const failSeq = scopedDb.sequence(input.sequenceId);

      await failSeq.updateMergedVideoFields({
        mergedVideoStatus: 'failed',
        mergedVideoError: error,
      });

      console.error(
        `[MergeAudioVideoWorkflow] Failed to mux sequence ${input.sequenceId}: ${error}`
      );

      return `Audio+video mux failed for sequence ${input.sequenceId}`;
    },
  }
);
