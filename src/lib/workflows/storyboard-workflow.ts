/**
 * Storyboard generation workflow
 * Verifies sequence data, clears existing frames, then invokes script analysis
 */

import { getDb } from '#db-client';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeImageToVideoModel,
  safeTextToImageModel,
} from '@/lib/ai/models';
import {
  DEFAULT_ANALYSIS_MODEL,
  getAnalysisModelById,
} from '@/lib/ai/models.config';
import { deleteFrame, getSequenceFrames } from '@/lib/db/helpers/frames';
import { getSequenceForUser } from '@/lib/db/helpers/sequences';
import { sequences, StyleConfigSchema, styles } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { validateSequenceAuth } from '@/lib/workflow/auth';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import type { StoryboardWorkflowInput } from '@/lib/workflow/types';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { eq } from 'drizzle-orm';

export const generateStoryboardWorkflow = createWorkflow(
  async (context: WorkflowContext<StoryboardWorkflowInput>) => {
    const input = context.requestPayload;

    console.log('[StoryboardWorkflow] Input received:', {
      sequenceId: input.sequenceId,
      teamId: input.teamId,
      userId: input.userId,
      autoGenerateMotion: input.autoGenerateMotion,
    });

    const {
      sequenceId,
      script,
      aspectRatio,
      styleConfig,
      analysisModelId,
      imageModel,
      videoModel,
    } = await context.run('verify-clear-and-start-processing', async () => {
      validateSequenceAuth(input);

      const sequence = await getSequenceForUser({
        sequenceId: input.sequenceId,
        teamId: input.teamId,
        userId: input.userId,
      });

      if (!sequence.script || sequence.script.trim().length === 0) {
        throw new WorkflowValidationError('Sequence has no script');
      }

      if (!sequence.styleId) {
        throw new WorkflowValidationError('Sequence has no style selected');
      }

      const style = await getDb().query.styles.findFirst({
        where: eq(styles.id, sequence.styleId),
      });

      if (!style) {
        throw new WorkflowValidationError('No style found');
      }

      const existingFrames = await getSequenceFrames(input.sequenceId);
      await Promise.all(existingFrames.map((frame) => deleteFrame(frame.id)));

      await getDb()
        .update(sequences)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(sequences.id, input.sequenceId));

      return {
        sequenceId: sequence.id,
        script: sequence.script,
        aspectRatio: sequence.aspectRatio,
        styleConfig: StyleConfigSchema.parse(style.config),
        analysisModelId:
          getAnalysisModelById(sequence.analysisModel)?.id ??
          DEFAULT_ANALYSIS_MODEL,
        imageModel: safeTextToImageModel(
          sequence.imageModel,
          DEFAULT_IMAGE_MODEL
        ),
        videoModel: safeImageToVideoModel(
          sequence.videoModel,
          DEFAULT_VIDEO_MODEL
        ),
      };
    });

    await context.invoke('analyze-script', {
      workflow: analyzeScriptWorkflow,
      workflowRunId: `analyze-script-${sequenceId}`,
      body: {
        userId: input.userId,
        teamId: input.teamId,
        sequenceId,
        script,
        aspectRatio,
        styleConfig,
        analysisModelId,
        imageModel,
        videoModel,
        autoGenerateMotion: input.autoGenerateMotion ?? false,
        autoGenerateMusic: input.autoGenerateMusic ?? false,
        musicModel: input.musicModel,
        suggestedTalentIds: input.suggestedTalentIds,
        suggestedLocationIds: input.suggestedLocationIds,
      },
      retries: 3,
      retryDelay: 'pow(2, retried) * 1000',
    });

    await context.run('emit-complete', async () => {
      getGenerationChannel(sequenceId).emit('generation.complete', {
        sequenceId,
      });
    });
  }
);
