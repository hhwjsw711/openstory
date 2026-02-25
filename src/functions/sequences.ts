import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import {
  authMiddleware,
  authWithTeamMiddleware,
  sequenceAccessMiddleware,
} from './middleware';
import {
  createSequenceSchema,
  updateSequenceSchema,
} from '@/lib/schemas/sequence.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { getSequenceById } from '@/lib/db/helpers/queries';
import {
  createSequence,
  deleteSequence,
  getSequencesByTeam,
  updateSequence,
  updateSequenceMusicPrompt,
} from '@/lib/db/helpers/sequences';
import { requireTeamMemberAccess } from '@/lib/auth/action-utils';
import {
  DEFAULT_ANALYSIS_MODEL,
  getAnalysisModelById,
} from '@/lib/ai/models.config';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeTextToImageModel,
  safeImageToVideoModel,
  isValidAudioModel,
} from '@/lib/ai/models';
import { DEFAULT_ASPECT_RATIO } from '@/lib/constants/aspect-ratios';
import { estimateStoryboardCost } from '@/lib/billing/cost-estimation';
import { requireCredits } from '@/lib/billing/preflight';
import { triggerWorkflow } from '@/lib/workflow/client';
import type {
  MergeVideoWorkflowInput,
  MusicSceneSummary,
  MusicWorkflowInput,
  StoryboardWorkflowInput,
} from '@/lib/workflow/types';
import { sequences, type Frame } from '@/lib/db/schema';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { getDb } from '#db-client';
import { eq } from 'drizzle-orm';

export const getSequencesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    return getSequencesByTeam(context.teamId);
  });

export const getSequenceFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(z.object({ sequenceId: ulidSchema })))
  .handler(async ({ context }) => {
    return context.sequence;
  });

/**
 * Create new sequence(s) with different analysis models.
 * Triggers storyboard generation workflow for each.
 */
export const createSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createSequenceSchema))
  .handler(async ({ data, context }) => {
    const teamId = data.teamId || context.teamId;

    if (data.teamId && data.teamId !== context.teamId) {
      await requireTeamMemberAccess(context.user.id, data.teamId);
    }

    const {
      styleId,
      aspectRatio,
      analysisModels,
      imageModel,
      videoModel,
      autoGenerateMotion = false,
      autoGenerateMusic = false,
      musicModel,
      suggestedTalentIds,
      suggestedLocationIds,
    } = data;

    if (!styleId || !aspectRatio) {
      throw new Error('Style ID and aspect ratio are required');
    }

    await requireCredits(
      teamId,
      estimateStoryboardCost({
        imageModel: safeTextToImageModel(imageModel, DEFAULT_IMAGE_MODEL),
        aspectRatio,
        autoGenerateMotion,
        videoModel: safeImageToVideoModel(videoModel, DEFAULT_VIDEO_MODEL),
      }),
      {
        providers: ['fal', 'openrouter'],
        errorMessage: 'Insufficient credits to generate storyboard',
      }
    );

    return Promise.all(
      analysisModels.map(async (modelId) => {
        const sequence = await createSequence({
          teamId,
          userId: context.user.id,
          title: data.title || 'Untitled Sequence',
          script: data.script,
          styleId,
          aspectRatio,
          analysisModel:
            getAnalysisModelById(modelId)?.id || DEFAULT_ANALYSIS_MODEL,
          imageModel,
          videoModel,
        });

        const workflowInput: StoryboardWorkflowInput = {
          userId: context.user.id,
          teamId,
          sequenceId: sequence.id,
          options: {
            framesPerScene: 3,
            generateThumbnails: true,
            generateDescriptions: true,
            aiProvider: 'openrouter',
            regenerateAll: true,
          },
          autoGenerateMotion,
          autoGenerateMusic,
          musicModel:
            musicModel && isValidAudioModel(musicModel)
              ? musicModel
              : undefined,
          suggestedTalentIds,
          suggestedLocationIds,
        };

        await triggerWorkflow('/storyboard', workflowInput, {
          deduplicationId: `storyboard-${sequence.id}`,
        });

        return sequence;
      })
    );
  });

/**
 * Update a sequence.
 * Triggers storyboard regeneration if script/style/aspectRatio/model changes.
 */
export const updateSequenceFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(
    zodValidator(updateSequenceSchema.extend({ sequenceId: ulidSchema }))
  )
  .handler(async ({ data, context }) => {
    const { sequenceId, ...updateData } = data;

    const needsRegeneration =
      updateData.script !== undefined ||
      updateData.styleId !== undefined ||
      updateData.aspectRatio !== undefined ||
      updateData.analysisModel !== undefined;

    const sequence = await updateSequence({
      id: sequenceId,
      userId: context.user.id,
      aspectRatio: updateData.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      ...updateData,
      status: needsRegeneration ? 'processing' : undefined,
    });

    if (needsRegeneration) {
      await requireCredits(
        context.teamId,
        estimateStoryboardCost({
          imageModel: safeTextToImageModel(
            sequence.imageModel,
            DEFAULT_IMAGE_MODEL
          ),
          aspectRatio: sequence.aspectRatio,
          videoModel: safeImageToVideoModel(
            sequence.videoModel,
            DEFAULT_VIDEO_MODEL
          ),
        }),
        {
          providers: ['fal', 'openrouter'],
          errorMessage: 'Insufficient credits to regenerate storyboard',
        }
      );

      await triggerWorkflow('/storyboard', {
        userId: context.user.id,
        teamId: context.teamId,
        sequenceId,
        options: {
          framesPerScene: 3,
          generateThumbnails: true,
          generateDescriptions: true,
          aiProvider: 'openrouter',
          regenerateAll: true,
        },
      } satisfies StoryboardWorkflowInput);
    }

    return sequence;
  });

// ============================================================================
// Retry Failed Storyboard
// ============================================================================

const retryStoryboardInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Retry a failed storyboard workflow.
 * Re-triggers the full analyze-script pipeline for the sequence.
 */
export const retryStoryboardFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(retryStoryboardInputSchema))
  .handler(async ({ context }) => {
    const { sequence, user, teamId } = context;

    if (sequence.status !== 'failed') {
      throw new Error('Only failed sequences can be retried');
    }

    await requireCredits(
      teamId,
      estimateStoryboardCost({
        imageModel: safeTextToImageModel(
          sequence.imageModel,
          DEFAULT_IMAGE_MODEL
        ),
        aspectRatio: sequence.aspectRatio,
        videoModel: safeImageToVideoModel(
          sequence.videoModel,
          DEFAULT_VIDEO_MODEL
        ),
      }),
      {
        providers: ['fal', 'openrouter'],
        errorMessage: 'Insufficient credits to retry storyboard',
      }
    );

    // Reset status to processing before triggering
    await getDb()
      .update(sequences)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(sequences.id, sequence.id));

    const workflowInput: StoryboardWorkflowInput = {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: 'openrouter',
        regenerateAll: true,
      },
    };

    // No deduplication ID — explicit user retry should always run
    await triggerWorkflow('/storyboard', workflowInput);

    return { success: true };
  });

// ============================================================================
// Delete Sequence
// ============================================================================

/** Delete a sequence (requires admin role) */
export const deleteSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(z.object({ sequenceId: ulidSchema })))
  .handler(async ({ data, context }) => {
    const sequence = await getSequenceById(data.sequenceId);

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    await requireTeamMemberAccess(context.user.id, sequence.teamId, 'admin');
    await deleteSequence(data.sequenceId);

    return { success: true };
  });

/** Build compact scene summaries from frames for music prompt generation */
function buildSceneSummaries(frames: Frame[]): MusicSceneSummary[] {
  return frames.map((frame) => {
    const music = frame.metadata?.audioDesign?.music;
    const meta = frame.metadata?.metadata;
    const durationSeconds = frame.durationMs
      ? frame.durationMs / 1000
      : (meta?.durationSeconds ?? 10);

    return {
      title: meta?.title || 'Untitled Scene',
      storyBeat: meta?.storyBeat || '',
      durationSeconds,
      musicStyle: music?.style || '',
      musicMood: music?.mood || '',
      musicPresence: music?.presence || 'none',
      atmosphere: frame.metadata?.audioDesign?.ambient?.atmosphere,
    };
  });
}

/**
 * Trigger sequence-level music generation.
 * Uses pre-generated prompt/tags when available, otherwise builds from frame audio specs.
 */
export const generateMusicFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        sequenceId: ulidSchema,
        prompt: z.string().optional(),
        tags: z.string().optional(),
        model: z.string().optional(),
      })
    )
  )
  .handler(async ({ data, context }) => {
    const { sequence, user } = context;

    const effectivePrompt = data.prompt ?? sequence.musicPrompt;
    const effectiveTags = data.tags ?? sequence.musicTags;

    if (data.prompt || data.tags) {
      await updateSequenceMusicPrompt(
        sequence.id,
        data.prompt ?? sequence.musicPrompt ?? '',
        data.tags ?? sequence.musicTags ?? ''
      );
    }

    const allFrames = await getSequenceFrames(data.sequenceId);

    const totalDuration = allFrames.reduce((sum, frame) => {
      const seconds = frame.durationMs
        ? frame.durationMs / 1000
        : (frame.metadata?.metadata?.durationSeconds ?? 10);
      return sum + seconds;
    }, 0);

    const baseInput = {
      userId: user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      duration: totalDuration || 30,
      model:
        data.model && isValidAudioModel(data.model) ? data.model : undefined,
    };

    const musicInput: MusicWorkflowInput =
      effectivePrompt && effectiveTags
        ? { ...baseInput, prompt: effectivePrompt, tags: effectiveTags }
        : { ...baseInput, scenes: buildSceneSummaries(allFrames) };

    await getDb()
      .update(sequences)
      .set({
        musicStatus: 'generating',
        musicError: null,
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequence.id));

    await triggerWorkflow('/music', musicInput);

    return { success: true };
  });

/**
 * Re-merge all frame videos, then auto-chain to audio mux.
 * The merge-video workflow triggers merge-audio-video when music is ready.
 */
export const mergeVideoAndMusicFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(z.object({ sequenceId: ulidSchema })))
  .handler(async ({ context }) => {
    const { sequence, user, teamId } = context;

    if (!sequence.musicUrl) {
      throw new Error('Music must be generated before merging');
    }

    const frames = await getSequenceFrames(sequence.id);

    if (frames.length === 0) {
      throw new Error('No frames found in sequence');
    }

    const incompleteCount = frames.filter(
      (f) => f.videoStatus !== 'completed' || !f.videoUrl
    ).length;

    if (incompleteCount > 0) {
      throw new Error(
        `${incompleteCount} frame(s) do not have completed videos`
      );
    }

    await requireCredits(teamId, 0.01, {
      errorMessage: 'Insufficient credits for video merge',
    });

    await getDb()
      .update(sequences)
      .set({
        mergedVideoStatus: 'merging',
        mergedVideoError: null,
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequence.id));

    const videoUrls = frames
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((f) => f.videoUrl)
      .filter((url): url is string => Boolean(url));

    await triggerWorkflow('/merge-video', {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      videoUrls,
    } satisfies MergeVideoWorkflowInput);

    return { success: true };
  });
