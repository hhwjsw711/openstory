/**
 * Frame Images Workflow
 *
 * Orchestrates frame image generation + automatic variant generation.
 * Runs as one strand in parallel with motion-music-prompts-workflow.
 */

import { aspectRatioToImageSize } from '@/lib/constants/aspect-ratios';
import { buildCharacterReferenceImages } from '@/lib/prompts/character-prompt';
import { buildLocationReferenceImages } from '@/lib/prompts/location-prompt';
import { getGenerationChannel } from '@/lib/realtime';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { createScopedWorkflow } from '@/lib/workflow/scoped-workflow';
import type {
  FrameImagesWorkflowInput,
  FrameImagesWorkflowResult,
  ImageWorkflowInput,
  VariantWorkflowInput,
} from '@/lib/workflow/types';
import { getFalFlowControl } from './constants';
import { generateImageWorkflow } from './image-workflow';
import {
  matchCharactersToScene,
  matchLocationsToScene,
} from './scene-matching';
import { generateVariantWorkflow } from './variant-workflow';

export const frameImagesWorkflow = createScopedWorkflow<
  FrameImagesWorkflowInput,
  FrameImagesWorkflowResult
>(
  async (context, _scopedDb) => {
    const input = context.requestPayload;
    const {
      scenesWithVisualPrompts,
      charactersWithSheets,
      locationsWithSheets,
      frameMapping,
      imageModel,
      aspectRatio,
      sequenceId,
    } = input;

    // Build per-scene character and location maps for reference image lookup
    const { sceneCharacterMap, sceneLocationMap } = await context.run(
      'build-reference-maps',
      () => ({
        sceneCharacterMap: Object.fromEntries(
          scenesWithVisualPrompts.map((scene) => [
            scene.sceneId,
            matchCharactersToScene(
              charactersWithSheets,
              scene.continuity?.characterTags || []
            ),
          ])
        ),
        sceneLocationMap: Object.fromEntries(
          scenesWithVisualPrompts.map((scene) => [
            scene.sceneId,
            matchLocationsToScene(
              locationsWithSheets,
              scene.continuity?.environmentTag || '',
              scene.metadata?.location || ''
            ),
          ])
        ),
      })
    );

    await context.run('frame-images-start', async () => {
      await getGenerationChannel(sequenceId).emit('generation.phase:start', {
        phase: 4,
        phaseName: 'Generating images\u2026',
      });
    });

    const imageSize = aspectRatioToImageSize(aspectRatio);

    // Generate frame images in parallel
    const imageUrls = await Promise.all(
      scenesWithVisualPrompts.map(async (scene) => {
        const visualPrompt = scene.prompts?.visual?.fullPrompt;
        if (!visualPrompt) {
          throw new WorkflowValidationError(
            `Scene ${scene.sceneId} has no visual prompt`
          );
        }

        const matchedFrame = frameMapping.find(
          (f) => f.sceneId === scene.sceneId
        );

        const characterRefs = buildCharacterReferenceImages(
          sceneCharacterMap[scene.sceneId] || []
        );
        const locationRefs = buildLocationReferenceImages(
          sceneLocationMap[scene.sceneId] || []
        );
        const allReferences = [...characterRefs, ...locationRefs];

        const result = await context.invoke('image', {
          workflow: generateImageWorkflow,
          body: {
            userId: input.userId,
            teamId: input.teamId,
            prompt: visualPrompt,
            model: imageModel,
            imageSize,
            numImages: 1,
            frameId: matchedFrame?.frameId,
            sequenceId,
            referenceImages:
              allReferences.length > 0 ? allReferences : undefined,
          } satisfies ImageWorkflowInput,
          retries: 3,
          retryDelay: 'pow(2, retried) * 1000',
          flowControl: getFalFlowControl(),
        });

        if (result.isFailed || result.isCanceled || !result.body.imageUrl) {
          throw new WorkflowValidationError(
            `Image generation failed for scene ${scene.sceneId}`
          );
        }

        // Now invoke the variant workflow
        await context.invoke('variant-image', {
          workflow: generateVariantWorkflow,
          body: {
            userId: input.userId,
            teamId: input.teamId,
            sequenceId,
            frameId: matchedFrame?.frameId,
            thumbnailUrl: result.body.imageUrl,
            scenePrompt: scene.prompts?.visual?.fullPrompt,
            characterReferences:
              characterRefs.length > 0 ? characterRefs : undefined,
            locationReferences:
              locationRefs.length > 0 ? locationRefs : undefined,
            aspectRatio,
            model: imageModel,
          } satisfies VariantWorkflowInput,
          retries: 3,
          retryDelay: 'pow(2, retried) * 1000',
          flowControl: getFalFlowControl(),
        });

        return result.body.imageUrl;
      })
    );

    return { imageUrls };
  },
  {
    failureFunction: async ({ context }) => {
      const { sequenceId } = context.requestPayload;
      if (sequenceId) {
        try {
          await getGenerationChannel(sequenceId).emit(
            'generation.phase:complete',
            {
              phase: 4,
            }
          );
        } catch {
          // Ignore emit errors
        }
      }
      return 'Frame image generation failed';
    },
  }
);
