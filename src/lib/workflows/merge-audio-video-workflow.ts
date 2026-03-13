/**
 * Merge Audio+Video Workflow
 * Muxes a music track onto the merged video to produce the final sequence output
 */

import { composeAudioVideo } from '@/lib/audio/compose-audio-video';
import { sanitizeFailResponse } from '@/lib/workflow/sanitize-fail-response';
import { usdToMicros } from '@/lib/billing/money';
import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';
import { uploadResponse } from '@/lib/storage/upload-response';
import {
  getExtensionFromUrl,
  getMimeTypeFromExtension,
} from '@/lib/utils/file';
import { generateId } from '@/lib/db/id';
import { createScopedDb } from '@/lib/db/scoped';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { MergeAudioVideoWorkflowInput } from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

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

    const scopedDb = createScopedDb(input.teamId);
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
        const frames = await getSequenceFrames(input.sequenceId);
        return frames.reduce((sum, f) => sum + (f.durationMs ?? 3000), 0);
      }
    );

    const muxResult = await context.run('compose-audio-video', async () => {
      return composeAudioVideo({
        videoUrl: input.mergedVideoUrl,
        musicUrl: input.musicUrl,
        durationMs: videoDurationMs,
        teamId: input.teamId,
      });
    });

    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        teamId: input.teamId,
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
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;
      const error = sanitizeFailResponse(failResponse);
      const failSeq = createScopedDb(input.teamId).sequence(input.sequenceId);

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
