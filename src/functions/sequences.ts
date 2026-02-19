/**
 * Sequence Server Functions
 * End-to-end type-safe functions for sequence operations
 */

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
import { getFalFlowControl } from '@/lib/workflows/constants';
import type {
  MergeVideoWorkflowInput,
  MusicSceneSummary,
  MusicWorkflowInput,
  StoryboardWorkflowInput,
} from '@/lib/workflow/types';
import type { Sequence } from '@/lib/db/schema';
import { sequences } from '@/lib/db/schema';
import { getSequenceFrames } from '@/lib/db/helpers/frames';
import { getDb } from '#db-client';
import { eq } from 'drizzle-orm';

// ============================================================================
// List Sequences
// ============================================================================

/**
 * Get all sequences for the user's default team
 * @returns Array of sequences
 */
export const getSequencesFn = createServerFn({ method: 'GET' })
  .middleware([authWithTeamMiddleware])
  .handler(async ({ context }) => {
    return getSequencesByTeam(context.teamId);
  });

// ============================================================================
// Get Single Sequence
// ============================================================================

const getSequenceInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Get a single sequence by ID
 * @param sequenceId - The sequence ID
 * @returns The sequence with optional frames
 */
export const getSequenceFn = createServerFn({ method: 'GET' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(getSequenceInputSchema))
  .handler(async ({ context }) => {
    return context.sequence;
  });

// ============================================================================
// Create Sequence
// ============================================================================

/**
 * Create new sequence(s)
 * Supports creating multiple sequences with different analysis models
 * @returns Array of created sequences
 */
export const createSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(createSequenceSchema))
  .handler(async ({ data, context }) => {
    console.log('[CreateSequence] Data:', data);
    const teamId = data.teamId || context.teamId;

    // Verify user has access if a different team was specified
    if (data.teamId && data.teamId !== context.teamId) {
      await requireTeamMemberAccess(context.user.id, data.teamId);
    }

    const { styleId, aspectRatio } = data;
    if (!styleId || !aspectRatio) {
      throw new Error('Style ID and aspect ratio are required');
    }

    const {
      analysisModels,
      imageModel,
      videoModel,
      autoGenerateMotion,
      autoGenerateMusic,
      musicModel,
      suggestedTalentIds,
      suggestedLocationIds,
    } = data;

    // Pre-flight billing check (skip if team has both BYOK keys)
    await requireCredits(
      teamId,
      estimateStoryboardCost({
        imageModel: safeTextToImageModel(imageModel, DEFAULT_IMAGE_MODEL),
        aspectRatio,
        autoGenerateMotion: autoGenerateMotion ?? false,
        videoModel: safeImageToVideoModel(videoModel, DEFAULT_VIDEO_MODEL),
      }),
      {
        providers: ['fal', 'openrouter'],
        errorMessage: 'Insufficient credits to generate storyboard',
      }
    );

    // Create sequences in parallel for each selected model
    const sequences = await Promise.all(
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

        // Trigger storyboard generation workflow
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
          autoGenerateMotion: autoGenerateMotion ?? false,
          autoGenerateMusic: autoGenerateMusic ?? false,
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

    return JSON.parse(JSON.stringify(sequences)) satisfies Sequence[];
  });

// ============================================================================
// Update Sequence
// ============================================================================

const updateSequenceInputSchema = updateSequenceSchema.extend({
  sequenceId: ulidSchema,
});

/**
 * Update a sequence
 * Triggers storyboard regeneration if script/style/aspectRatio/model changes
 * @returns The updated sequence
 */
export const updateSequenceFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(updateSequenceInputSchema))
  .handler(async ({ data, context }) => {
    const { sequenceId, ...updateData } = data;

    // Check if we need to regenerate the storyboard
    const needToRegenerateStoryboard =
      updateData.script !== undefined ||
      updateData.styleId !== undefined ||
      updateData.aspectRatio !== undefined ||
      updateData.analysisModel !== undefined;

    // Update sequence
    const sequence = await updateSequence({
      id: sequenceId,
      userId: context.user.id,
      aspectRatio: updateData.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      ...updateData,
      status: needToRegenerateStoryboard ? 'processing' : undefined,
    });

    // Trigger storyboard regeneration if needed
    if (needToRegenerateStoryboard) {
      // Pre-flight billing check (skip if team has both BYOK keys)
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

      const workflowInput: StoryboardWorkflowInput = {
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
      };

      await triggerWorkflow('/storyboard', workflowInput);
    }

    return JSON.parse(JSON.stringify(sequence)) satisfies Sequence;
  });

// ============================================================================
// Delete Sequence
// ============================================================================

const deleteSequenceInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Delete a sequence (requires admin role)
 */
export const deleteSequenceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(deleteSequenceInputSchema))
  .handler(async ({ data, context }) => {
    // Get the sequence to verify team ownership
    const sequence = await getSequenceById(data.sequenceId);

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    // Require admin access to delete
    await requireTeamMemberAccess(context.user.id, sequence.teamId, 'admin');

    // Delete the sequence (frames will be cascade deleted)
    await deleteSequence(data.sequenceId);

    return { success: true };
  });

// ============================================================================
// Generate Music
// ============================================================================

const generateMusicInputSchema = z.object({
  sequenceId: ulidSchema,
  prompt: z.string().optional(),
  tags: z.string().optional(),
  model: z.string().optional(),
});

/**
 * Trigger sequence-level music generation
 * Builds a combined prompt from all frames' audioDesign.music specs
 */
export const generateMusicFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(generateMusicInputSchema))
  .handler(async ({ data, context }) => {
    const { sequence, user } = context;

    // Resolve effective prompt/tags: user overrides > stored on sequence > build from frames
    const effectivePrompt = data.prompt ?? sequence.musicPrompt;
    const effectiveTags = data.tags ?? sequence.musicTags;

    // If user provided overrides, save them to DB
    if (data.prompt || data.tags) {
      await updateSequenceMusicPrompt(
        sequence.id,
        data.prompt ?? sequence.musicPrompt ?? '',
        data.tags ?? sequence.musicTags ?? ''
      );
    }

    // Fetch frames once (used in both branches)
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

    let musicInput: MusicWorkflowInput;

    if (effectivePrompt && effectiveTags) {
      // Use pre-generated prompt (skip LLM in workflow)
      musicInput = {
        ...baseInput,
        prompt: effectivePrompt,
        tags: effectiveTags,
      };
    } else {
      // Legacy fallback: build scenes from frames (no stored prompt)
      const scenes: MusicSceneSummary[] = allFrames.map((frame) => {
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
          atmosphere:
            frame.metadata?.audioDesign?.ambient?.atmosphere || undefined,
        };
      });

      musicInput = { ...baseInput, scenes };
    }

    // Set status to generating before triggering workflow so polls see it immediately
    await getDb()
      .update(sequences)
      .set({
        musicStatus: 'generating',
        musicError: null,
        updatedAt: new Date(),
      })
      .where(eq(sequences.id, sequence.id));

    await triggerWorkflow('/music', musicInput, {
      flowControl: getFalFlowControl(),
    });

    return { success: true };
  });

// ============================================================================
// Merge Video + Music (re-merge frames then auto-mux music)
// ============================================================================

const mergeVideoAndMusicInputSchema = z.object({
  sequenceId: ulidSchema,
});

/**
 * Re-merge all frame videos, then auto-chain to audio mux.
 * The merge-video workflow already triggers merge-audio-video when music is ready.
 */
export const mergeVideoAndMusicFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(mergeVideoAndMusicInputSchema))
  .handler(async ({ context }) => {
    const { sequence, user, teamId } = context;

    if (!sequence.musicUrl) {
      throw new Error('Music must be generated before merging');
    }

    // Gather frame videos
    const frames = await getSequenceFrames(sequence.id);

    if (frames.length === 0) {
      throw new Error('No frames found in sequence');
    }

    const incompleteFrames = frames.filter(
      (f) => f.videoStatus !== 'completed' || !f.videoUrl
    );

    if (incompleteFrames.length > 0) {
      throw new Error(
        `${incompleteFrames.length} frame(s) do not have completed videos`
      );
    }

    await requireCredits(teamId, 0.01, {
      errorMessage: 'Insufficient credits for video merge',
    });

    // Set status to merging before triggering workflow so polls see it immediately
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

    const input: MergeVideoWorkflowInput = {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      videoUrls,
    };

    // No deduplication ID — explicit user re-trigger should always work
    await triggerWorkflow('/merge-video', input, {
      flowControl: getFalFlowControl(),
    });

    return { success: true };
  });
