import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { sequenceAccessMiddleware, frameAccessMiddleware } from './middleware';
import {
  regenerateFrameSchema,
  generateVariantSchema,
} from '@/lib/schemas/frame.schemas';
import { ulidSchema } from '@/lib/schemas/id.schemas';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  safeTextToImageModel,
  safeImageToVideoModel,
} from '@/lib/ai/models';
import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import {
  estimateImageCost,
  estimateStoryboardCost,
} from '@/lib/billing/cost-estimation';
import { requireCredits } from '@/lib/billing/preflight';
import type {
  ImageWorkflowInput,
  StoryboardWorkflowInput,
  VariantWorkflowInput,
  UpscaleVariantWorkflowInput,
} from '@/lib/workflow/types';
import { triggerWorkflow } from '@/lib/workflow/client';
import { cropTileFromGrid } from '@/lib/image/image-crop';
import { uploadImageBufferToStorage } from '@/lib/image/image-storage';
import { locationMatchesTag } from '@/lib/db/scoped/sequence-locations';
import type { Character, SequenceLocation } from '@/lib/db/schema';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import { buildLocationReferenceImages } from '@/lib/prompts/location-prompt';
import type { ReferenceImageDescription } from '@/lib/prompts/reference-image-prompt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Match characters by continuity tags and return their reference sheet images. */
function getSceneCharacterReferenceImages(
  allCharacters: Character[],
  characterTags: string[]
): ReferenceImageDescription[] {
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

/** Match locations by environmentTag or scene location and return reference images. */
function getSceneLocationReferenceImages(
  allLocations: SequenceLocation[],
  environmentTag: string,
  sceneLocation?: string
): ReferenceImageDescription[] {
  if (!environmentTag && !sceneLocation) return [];

  const matchedLocations = allLocations.filter(
    (loc) =>
      (environmentTag && locationMatchesTag(loc, environmentTag)) ||
      (sceneLocation && locationMatchesTag(loc, sceneLocation))
  );

  return buildLocationReferenceImages(matchedLocations);
}

// ---------------------------------------------------------------------------
// Generate Frames (Storyboard Workflow)
// ---------------------------------------------------------------------------

export const generateFramesFn = createServerFn({ method: 'POST' })
  .middleware([sequenceAccessMiddleware])
  .handler(async ({ context }) => {
    const { sequence, user } = context;

    await requireCredits(
      sequence.teamId,
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
        errorMessage: 'Insufficient credits to generate storyboard',
      }
    );

    const workflowInput: StoryboardWorkflowInput = {
      userId: user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: 'openrouter',
        regenerateAll: true,
      },
    };

    const workflowRunId = await triggerWorkflow('/storyboard', workflowInput, {
      deduplicationId: `storyboard-${sequence.id}-${Date.now()}`,
    });

    return { workflowRunId, frames: [] };
  });

// ---------------------------------------------------------------------------
// Generate Image for Frame
// ---------------------------------------------------------------------------

const generateImageInputSchema = regenerateFrameSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

export const generateFrameImageFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateImageInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence, user } = context;

    // Priority: provided > stored > AI-generated > description
    const prompt =
      data.prompt ||
      frame.imagePrompt ||
      frame.metadata?.prompts?.visual?.fullPrompt ||
      frame.description;

    if (!prompt) {
      throw new Error('Frame has no prompt or description to regenerate from');
    }

    const allCharacters = await context.scopedDb.characters.listWithSheets(
      sequence.id
    );
    const characterTags = frame.metadata?.continuity?.characterTags ?? [];
    const referenceImages = getSceneCharacterReferenceImages(
      allCharacters,
      characterTags
    );

    const model =
      data.model || safeTextToImageModel(frame.imageModel, DEFAULT_IMAGE_MODEL);

    await requireCredits(
      sequence.teamId,
      estimateImageCost(model, sequence.aspectRatio, 1),
      { errorMessage: 'Insufficient credits for image generation' }
    );

    const workflowInput: ImageWorkflowInput = {
      userId: user.id,
      teamId: sequence.teamId,
      prompt,
      model,
      imageSize: aspectRatioToImageSize(sequence.aspectRatio),
      numImages: 1,
      frameId: frame.id,
      sequenceId: sequence.id,
      referenceImages,
    };

    const workflowRunId = await triggerWorkflow('/image', workflowInput, {
      deduplicationId: `image-${frame.id}-${Date.now()}`,
    });

    return { workflowRunId, frameId: frame.id };
  });

// ---------------------------------------------------------------------------
// Generate Variants for Frame
// ---------------------------------------------------------------------------

const generateVariantsInputSchema = generateVariantSchema.extend({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
});

export const generateFrameVariantsFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(generateVariantsInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence, user } = context;

    if (!frame.thumbnailUrl) {
      throw new Error('Frame must have a thumbnail image to generate variants');
    }

    const allCharacters = await context.scopedDb.characters.listWithSheets(
      sequence.id
    );
    const characterTags = frame.metadata?.continuity?.characterTags ?? [];
    const characterReferences = getSceneCharacterReferenceImages(
      allCharacters,
      characterTags
    );

    const allLocations =
      await context.scopedDb.sequenceLocations.listWithReferences(sequence.id);
    const locationReferences = getSceneLocationReferenceImages(
      allLocations,
      frame.metadata?.continuity?.environmentTag ?? '',
      frame.metadata?.metadata?.location ?? ''
    );

    const numImages = data.numImages ?? 1;
    await requireCredits(
      sequence.teamId,
      estimateImageCost(
        data.model ?? DEFAULT_IMAGE_MODEL,
        sequence.aspectRatio,
        numImages
      ),
      { errorMessage: 'Insufficient credits for variant generation' }
    );

    const workflowInput: VariantWorkflowInput = {
      userId: user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      thumbnailUrl: frame.thumbnailUrl,
      model: data.model,
      imageSize: data.imageSize || aspectRatioToImageSize(sequence.aspectRatio),
      numImages,
      seed: data.seed,
      characterReferences,
      locationReferences,
    };

    const workflowRunId = await triggerWorkflow(
      '/variant-image',
      workflowInput,
      { deduplicationId: `variant-${frame.id}-${Date.now()}` }
    );

    return { workflowRunId, frameId: frame.id };
  });

// ---------------------------------------------------------------------------
// Select Variant
// ---------------------------------------------------------------------------

const selectVariantInputSchema = z.object({
  sequenceId: ulidSchema,
  frameId: ulidSchema,
  variantIndex: z.number().int().min(0).max(8),
});

/** Convert 0-8 grid index to 1-based row/col in a 3x3 grid. */
function indexToRowCol(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / 3) + 1,
    col: (index % 3) + 1,
  };
}

export const selectFrameVariantFn = createServerFn({ method: 'POST' })
  .middleware([frameAccessMiddleware])
  .inputValidator(zodValidator(selectVariantInputSchema))
  .handler(async ({ context, data }) => {
    const { frame, sequence, user } = context;

    if (!frame.variantImageUrl) {
      throw new Error('Frame has no variant image to select from');
    }

    const { row, col } = indexToRowCol(data.variantIndex);

    const cropResult = await cropTileFromGrid({
      gridImageUrl: frame.variantImageUrl,
      row,
      col,
    });

    const uploadResult = await uploadImageBufferToStorage({
      imageBuffer: cropResult.buffer,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      contentType: 'image/png',
    });

    if (!uploadResult.url) {
      throw new Error('Failed to upload cropped image to storage');
    }

    // Set cropped thumbnail and clear stale motion fields
    await context.scopedDb.frames.update(frame.id, {
      thumbnailUrl: uploadResult.url,
      thumbnailPath: uploadResult.path || null,
      thumbnailStatus: 'generating',
      thumbnailError: null,
      videoUrl: null,
      videoPath: null,
      videoStatus: 'pending',
      videoWorkflowRunId: null,
      videoGeneratedAt: null,
      videoError: null,
    });

    await requireCredits(
      sequence.teamId,
      estimateImageCost('nano_banana_2', '16:9', 1),
      { errorMessage: 'Insufficient credits for variant upscale' }
    );

    const workflowInput: UpscaleVariantWorkflowInput = {
      userId: user.id,
      teamId: sequence.teamId,
      sequenceId: sequence.id,
      frameId: frame.id,
      croppedTileUrl: uploadResult.url,
      croppedTilePath: uploadResult.path || '',
    };

    const workflowRunId = await triggerWorkflow(
      '/upscale-variant',
      workflowInput,
      { deduplicationId: `upscale-variant-${frame.id}-${Date.now()}` }
    );

    return {
      frameId: frame.id,
      thumbnailUrl: uploadResult.url,
      variantIndex: data.variantIndex,
      upscaleWorkflowRunId: workflowRunId,
    };
  });
