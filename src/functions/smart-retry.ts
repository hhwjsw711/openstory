/**
 * Smart Retry Server Function
 * Detects what failed in a sequence and only retries those parts.
 * Falls back to full storyboard retry when prompts are missing.
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { sequenceAccessMiddleware } from './middleware';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import { analyzeFailures } from '@/lib/failures/failure-analysis';
import { requireCredits } from '@/lib/billing/preflight';
import {
  addMicros,
  multiplyMicros,
  ZERO_MICROS,
  usdToMicros,
} from '@/lib/billing/money';
import {
  estimateImageCost,
  estimateStoryboardCost,
  estimateVideoCost,
} from '@/lib/billing/cost-estimation';
import { triggerWorkflow } from '@/lib/workflow/client';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODELS,
  safeImageToVideoModel,
  safeTextToImageModel,
} from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import type {
  ImageWorkflowInput,
  MotionWorkflowInput,
  MusicWorkflowInput,
  MergeVideoWorkflowInput,
  StoryboardWorkflowInput,
} from '@/lib/workflow/types';
import type { Frame } from '@/lib/db/schema/frames';
import type { Character } from '@/lib/db/schema';

function resolveMotionPrompt(frame: Frame): string {
  return (
    frame.motionPrompt ||
    frame.metadata?.prompts?.motion?.fullPrompt ||
    frame.description ||
    ''
  );
}

function getSceneCharacterReferenceImages(
  allCharacters: Character[],
  characterTags: string[]
) {
  if (characterTags.length === 0) return [];

  const matchedCharacters = allCharacters.filter((char) => {
    const consistencyTag = (char.consistencyTag ?? '').toLowerCase();
    const charName = char.name.toLowerCase();

    return characterTags.some((tag) => {
      const tagLower = tag.toLowerCase();
      return (
        (consistencyTag && tagLower.includes(consistencyTag)) ||
        tagLower.includes(charName) ||
        tagLower.includes(char.characterId.toLowerCase())
      );
    });
  });

  return buildCharacterReferenceImages(matchedCharacters);
}

export const smartRetryFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .inputValidator(zodValidator(z.object({ sequenceId: ulidSchema })))
  .handler(async ({ context }) => {
    const { sequence, user, teamId } = context;
    const frames = await context.scopedDb.frames.listBySequence(sequence.id);
    const summary = analyzeFailures(frames, sequence);

    if (!summary.hasFailed) {
      throw new Error('No failures found to retry');
    }

    // Full retry fallback
    if (summary.requiresFullRetry) {
      const imageModel = safeTextToImageModel(
        sequence.imageModel,
        DEFAULT_IMAGE_MODEL
      );
      const videoModel = safeImageToVideoModel(
        sequence.videoModel,
        DEFAULT_VIDEO_MODEL
      );

      await requireCredits(
        context.scopedDb,
        estimateStoryboardCost({
          imageModel,
          aspectRatio: sequence.aspectRatio,
          videoModel,
        }),
        {
          providers: ['fal', 'openrouter'],
          errorMessage: 'Insufficient credits to retry storyboard',
        }
      );

      await context.scopedDb.sequence(sequence.id).updateStatus('processing');

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

      await triggerWorkflow('/storyboard', workflowInput);

      return { retryType: 'full' as const, retriedItems: ['full storyboard'] };
    }

    // Smart retry: only retry failed parts
    const retried: string[] = [];
    let totalCost = ZERO_MICROS;

    const imageModel = safeTextToImageModel(
      sequence.imageModel,
      DEFAULT_IMAGE_MODEL
    );
    const videoModel = safeImageToVideoModel(
      sequence.videoModel,
      DEFAULT_VIDEO_MODEL
    );

    // Collect failed items and estimate costs
    const failedImageFrames = frames.filter(
      (f) => f.thumbnailStatus === 'failed'
    );
    const failedMotionFrames = frames.filter(
      (f) => f.videoStatus === 'failed' && f.thumbnailUrl && f.motionPrompt
    );
    const hasMusicFailure =
      sequence.musicStatus === 'failed' && sequence.musicPrompt;
    const hasMergeFailure = sequence.mergedVideoStatus === 'failed';

    // Calculate total cost
    if (failedImageFrames.length > 0) {
      totalCost = addMicros(
        totalCost,
        estimateImageCost(
          imageModel,
          sequence.aspectRatio,
          failedImageFrames.length
        )
      );
    }

    if (failedMotionFrames.length > 0) {
      const duration =
        IMAGE_TO_VIDEO_MODELS[videoModel].capabilities.defaultDuration;
      totalCost = addMicros(
        totalCost,
        multiplyMicros(
          estimateVideoCost(videoModel, duration),
          failedMotionFrames.length
        )
      );
    }

    if (hasMergeFailure) {
      totalCost = addMicros(totalCost, usdToMicros(0.01));
    }

    // Single credit check for all retries
    if (totalCost > 0) {
      await requireCredits(context.scopedDb, totalCost, {
        providers: ['fal'],
        errorMessage: 'Insufficient credits to retry failed items',
      });
    }

    // 1. Retry failed images
    if (failedImageFrames.length > 0) {
      const allCharacters = await context.scopedDb.characters.listWithSheets(
        sequence.id
      );

      for (const frame of failedImageFrames) {
        const prompt =
          frame.imagePrompt ||
          frame.metadata?.prompts?.visual?.fullPrompt ||
          frame.description;

        if (!prompt) continue;

        const characterTags = frame.metadata?.continuity?.characterTags ?? [];
        const referenceImages = getSceneCharacterReferenceImages(
          allCharacters,
          characterTags
        );

        const workflowInput: ImageWorkflowInput = {
          userId: user.id,
          teamId,
          prompt,
          model: imageModel,
          imageSize: aspectRatioToImageSize(sequence.aspectRatio),
          numImages: 1,
          frameId: frame.id,
          sequenceId: sequence.id,
          referenceImages,
        };

        await triggerWorkflow('/image', workflowInput);
      }

      retried.push(`${failedImageFrames.length} image(s)`);
    }

    // 2. Retry failed motion
    if (failedMotionFrames.length > 0) {
      for (const frame of failedMotionFrames) {
        if (!frame.thumbnailUrl) continue;

        const workflowInput: MotionWorkflowInput = {
          userId: user.id,
          teamId,
          frameId: frame.id,
          sequenceId: sequence.id,
          imageUrl: frame.thumbnailUrl,
          prompt: resolveMotionPrompt(frame),
          model: videoModel,
          aspectRatio: sequence.aspectRatio,
        };

        await triggerWorkflow('/motion', workflowInput);
      }

      retried.push(`${failedMotionFrames.length} motion video(s)`);
    }

    // 3. Retry failed music
    if (hasMusicFailure && sequence.musicPrompt) {
      const allFrames = await context.scopedDb.frames.listBySequence(
        sequence.id
      );
      const totalDuration = allFrames.reduce((sum, frame) => {
        const seconds = frame.durationMs
          ? frame.durationMs / 1000
          : (frame.metadata?.metadata?.durationSeconds ?? 10);
        return sum + seconds;
      }, 0);

      const musicInput: MusicWorkflowInput = {
        userId: user.id,
        teamId,
        sequenceId: sequence.id,
        prompt: sequence.musicPrompt,
        tags: sequence.musicTags ?? undefined,
        duration: totalDuration || 30,
      };

      await context.scopedDb.sequence(sequence.id).updateMusicFields({
        musicStatus: 'generating',
        musicError: null,
      });

      await triggerWorkflow('/music', musicInput);

      retried.push('music');
    }

    // 4. Retry failed merge
    if (hasMergeFailure) {
      const allFrames = await context.scopedDb.frames.listBySequence(
        sequence.id
      );
      const incompleteCount = allFrames.filter(
        (f) => f.videoStatus !== 'completed' || !f.videoUrl
      ).length;

      if (incompleteCount === 0) {
        const videoUrls = allFrames
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((f) => f.videoUrl)
          .filter((url): url is string => Boolean(url));

        await context.scopedDb.sequence(sequence.id).updateMergedVideoFields({
          mergedVideoStatus: 'merging',
          mergedVideoError: null,
        });

        const mergeInput: MergeVideoWorkflowInput = {
          userId: user.id,
          teamId,
          sequenceId: sequence.id,
          videoUrls,
        };

        await triggerWorkflow('/merge-video', mergeInput);

        retried.push('video merge');
      }
    }

    // Reset sequence status from 'failed' back to 'completed'
    if (sequence.status === 'failed') {
      await context.scopedDb.sequence(sequence.id).updateStatus('completed');
    }

    return { retryType: 'smart' as const, retriedItems: retried };
  });
