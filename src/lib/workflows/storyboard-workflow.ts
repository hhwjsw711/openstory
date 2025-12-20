/**
 * Frame generation workflow
 * Orchestrates script analysis, frame creation, and thumbnail generation
 */

import { getDb } from '#db-client';
import { analyzeScriptWorkflow } from '@/lib/workflows/analyze-script-workflow';
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
import { getSequenceForUser } from '@/lib/db/helpers/sequences';
import { sequences, styles } from '@/lib/db/schema';
import { getGenerationChannel } from '@/lib/realtime';
import { DirectorDnaConfigSchema } from '@/lib/services/director-dna-types';
import { frameService } from '@/lib/services/frame.service';
import {
  validateSequenceAuth,
  type StoryboardWorkflowInput,
} from '@/lib/workflow';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { eq } from 'drizzle-orm';

const maxDuration = 800; // This function can run for a maximum of 800 seconds

export const generateStoryboardWorkflow = createWorkflow(
  async (context: WorkflowContext<StoryboardWorkflowInput>) => {
    const input = context.requestPayload;

    console.log('[StoryboardWorkflow] Input received:', {
      sequenceId: input.sequenceId,
      teamId: input.teamId,
      userId: input.userId,
      suggestedTalentIds: input.suggestedTalentIds,
      autoGenerateMotion: input.autoGenerateMotion,
    });

    // Helper to safely emit events (no-op if realtime unavailable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emit = async (event: string, data: any) => {
      if (!input.sequenceId) return;
      const channel = getGenerationChannel(input.sequenceId);
      if (!channel) return;
      try {
        console.log('emitting event', event, data);
        await channel.emit(
          `generation.${event}` as 'generation.complete',
          data
        );
      } catch (error) {
        console.warn(
          '[StoryboardGenerationWorkflow] Failed to emit event:',
          error
        );
      }
    };

    // Step 1: Verify sequence and get data
    const {
      sequenceId,
      script,
      aspectRatio,
      styleConfig,
      analysisModelId,
      imageModel,
      videoModel,
    } = await context.run('verify-clear-and-start-processing', async () => {
      // Validate authentication
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

      // Delete existing frames
      const existingFrames = await frameService.getFramesBySequence(
        input.sequenceId
      );

      if (existingFrames.length > 0) {
        await Promise.all(
          existingFrames.map((frame) => frameService.deleteFrame(frame.id))
        );
      }

      // Set sequence status to processing
      await getDb()
        .update(sequences)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(sequences.id, input.sequenceId));

      const styleConfig = DirectorDnaConfigSchema.parse(style.config);

      // Use the sequence's models (fall back to defaults if not set)
      // Runtime validation prevents invalid model keys from causing downstream failures

      const analysisModelId =
        getAnalysisModelById(sequence.analysisModel)?.id ||
        DEFAULT_ANALYSIS_MODEL;
      const imageModel = safeTextToImageModel(
        sequence.imageModel,
        DEFAULT_IMAGE_MODEL
      );
      const videoModel = safeImageToVideoModel(
        sequence.videoModel,
        DEFAULT_VIDEO_MODEL
      );

      return {
        sequenceId: sequence.id,
        script: sequence.script,
        aspectRatio: sequence.aspectRatio,
        styleConfig,
        analysisModelId,
        imageModel,
        videoModel,
      };
    });

    await context.invoke('analyze-script', {
      workflow: analyzeScriptWorkflow,
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
        suggestedTalentIds: input.suggestedTalentIds,
      },
      retries: 3,
      retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
    });

    // Emit generation complete
    await context.run('emit-complete', async () => {
      await emit('complete', {
        sequenceId,
      });
    });
  },
  {
    retries: 3,
    retryDelay: 'pow(2, retried) * 1000', // 1s, 2s, 4s, 8s
  }
);
