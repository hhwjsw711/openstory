/**
 * Storyboard generation workflow
 * Verifies sequence data, clears existing frames, then invokes script analysis
 */

import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  safeImageToVideoModel,
  safeTextToImageModel,
} from '@/lib/ai/models';
import {
  DEFAULT_ANALYSIS_MODEL,
  getAnalysisModelById,
} from '@/lib/ai/models.config';
import { StyleConfigSchema } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { validateSequenceAuth } from '@/lib/workflow/auth';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type { StoryboardWorkflowInput } from '@/lib/workflow/types';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
import { fastPreviewWorkflow } from '@/lib/workflows/fast-preview-workflow';

export const generateStoryboardWorkflow =
  createScopedWorkflow<StoryboardWorkflowInput>(async (context, scopedDb) => {
    const input = context.requestPayload;

    const { sequenceId, teamId, userId } = input;

    console.log('[StoryboardWorkflow] Input received:', {
      sequenceId: input.sequenceId,
      teamId: input.teamId,
      userId: input.userId,
      autoGenerateMotion: input.autoGenerateMotion,
    });
    if (!sequenceId || !teamId || !userId) {
      throw new WorkflowValidationError(
        'Sequence ID, team ID, and user ID are required'
      );
    }
    const seq = scopedDb.sequence(sequenceId);

    const {
      script,
      aspectRatio,
      styleConfig,
      analysisModelId,
      imageModel,
      videoModel,
    } = await context.run('verify-clear-and-start-processing', async () => {
      validateSequenceAuth(input);

      const sequence = await scopedDb.sequences.getForUser({
        sequenceId,
      });

      if (!sequence.script || sequence.script.trim().length === 0) {
        throw new WorkflowValidationError('Sequence has no script');
      }

      if (!sequence.styleId) {
        throw new WorkflowValidationError('Sequence has no style selected');
      }

      const style = await scopedDb.styles.getById(sequence.styleId);

      if (!style) {
        throw new WorkflowValidationError('No style found');
      }

      const existingFrames = await scopedDb.frames.listBySequence(sequenceId);
      await Promise.all(
        existingFrames.map((frame) => scopedDb.frames.delete(frame.id))
      );

      await seq.updateStatus('processing');

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

    // Determine if we should run fast preview
    // Skip preview if user already chose a fast-tier model (final images would be just as fast)
    const isFastModel =
      IMAGE_MODELS[imageModel].tier === 'fast' ||
      IMAGE_MODELS[imageModel].tier === 'ultra-fast';

    const analyzeScriptInvocation = context.invoke('analyze-script', {
      workflow: analyzeScriptWorkflow,
      workflowRunId: `analyze-script-${sequenceId}-${Date.now()}`,
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

    if (isFastModel) {
      // Fast model selected — skip preview, just run analysis pipeline
      await analyzeScriptInvocation;
    } else {
      // Run fast preview and full analysis in parallel
      await Promise.all([
        context.invoke('fast-preview', {
          workflow: fastPreviewWorkflow,
          workflowRunId: `fast-preview-${sequenceId}-${Date.now()}`,
          body: {
            userId: input.userId,
            teamId: input.teamId,
            sequenceId,
            script,
            aspectRatio,
          },
          retries: 1, // Preview is best-effort
        }),
        analyzeScriptInvocation,
      ]);
    }

    await context.run('emit-complete', async () => {
      await getGenerationChannel(sequenceId).emit('generation.complete', {
        sequenceId,
      });
    });
  });
