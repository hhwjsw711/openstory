import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { deductCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import type { ImageWorkflowInput } from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { buildReferenceImagePrompt } from '../prompts/reference-image-prompt';
import { getFalFlowControl } from './constants';

export const generateImageWorkflow = createWorkflow(
  async (context: WorkflowContext<ImageWorkflowInput>) => {
    const input = context.requestPayload;

    // Step 1: Set status to generating if frameId is provided
    const generationParams: ImageGenerationParams | null = await context.run(
      'set-generating-status',
      async () => {
        // Validate required fields
        if (!input.prompt || input.prompt.trim().length === 0) {
          throw new WorkflowValidationError(
            'Prompt is required for image generation'
          );
        }

        console.log(
          '[ImageWorkflow]',
          `Starting image generation workflow for user ${input.userId}`
        );

        const model = input.model || DEFAULT_IMAGE_MODEL;

        if (input.frameId) {
          // update frame status to generating and store user prompt
          const frame = await updateFrame(
            input.frameId,
            {
              thumbnailStatus: 'generating',
              thumbnailWorkflowRunId: context.workflowRunId,
              imageModel: model,
              imagePrompt: input.prompt,
            },
            { throwOnMissing: false }
          );

          if (!frame) {
            console.log(
              '[ImageWorkflow]',
              `Frame ${input.frameId} was deleted, skipping workflow`
            );
            return null; // Signal to skip
          }

          // Emit realtime progress
          await getGenerationChannel(input.sequenceId)?.emit(
            'generation.image:progress',
            {
              frameId: input.frameId,
              status: 'generating',
            }
          );
        }

        // Return the generation params so it shows in the workflow context for debugging
        // Build the prompt with reference images
        return {
          model,
          prompt: buildReferenceImagePrompt(
            input.prompt,
            input.referenceImages ?? []
          ).prompt,
          imageSize: input.imageSize ?? DEFAULT_IMAGE_SIZE,
          numImages: input.numImages ?? 1,
          seed: input.seed,
          referenceImageUrls:
            input.referenceImages?.map((image) => image.referenceImageUrl) ??
            [],
          traceName: 'frame-image',
        } satisfies ImageGenerationParams;
      }
    );

    // Early exit if frame was deleted
    if (!generationParams) {
      return {
        imageUrl: '',
        frameId: input.frameId,
        sequenceId: input.sequenceId,
      };
    }

    // Step 2: Generate image
    const imageResult = await context.run('generate-image', async () => {
      console.log(
        '[ImageWorkflow]',
        `Generating image ${input.frameId} with model ${generationParams.model}`
      );

      return await generateImageWithProvider(generationParams);
    });

    // Deduct credits for image generation
    const imageCost =
      typeof imageResult.metadata.cost === 'number'
        ? imageResult.metadata.cost
        : 0;
    const { teamId } = input;
    if (imageCost > 0 && teamId) {
      await context.run('deduct-credits', async () => {
        await deductCredits(teamId, imageCost, {
          userId: input.userId,
          description: `Image generation (${generationParams.model})`,
          metadata: {
            model: generationParams.model,
            frameId: input.frameId,
            sequenceId: input.sequenceId,
          },
        });
      });
    }

    let imageUrl: string = imageResult.imageUrls[0];

    if (imageUrl && input.frameId && input.sequenceId && input.teamId) {
      await context.run('upload-to-storage', async () => {
        // We need to check these again as this is an async step and the values may have changed
        if (!input.frameId || !input.sequenceId || !input.teamId || !imageUrl) {
          throw new Error('Missing required IDs for storage upload', {
            cause: JSON.stringify(imageResult),
          });
        }

        const result = await uploadImageToStorage({
          imageUrl,
          teamId: input.teamId,
          sequenceId: input.sequenceId,
          frameId: input.frameId,
        });

        if (!result.url) {
          throw new Error('Failed to upload image to storage');
        }

        imageUrl = result.url;

        const updatedFrame = await updateFrame(
          input.frameId,
          {
            thumbnailPath: result.path || null, // Store R2 path (permanent)
            thumbnailUrl: result.url, // Store public URL (permanent, not signed)
            thumbnailStatus: 'completed',
            thumbnailGeneratedAt: new Date(),
            thumbnailError: null,
            // Clear motion fields since the thumbnail changed
            videoUrl: null,
            videoPath: null,
            videoStatus: 'pending',
            videoWorkflowRunId: null,
            videoGeneratedAt: null,
            videoError: null,
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[ImageWorkflow]',
            `Frame ${input.frameId} was deleted, skipping final update`
          );
          return { url: result.url, path: result.path };
        }

        // Emit completion progress
        await getGenerationChannel(input.sequenceId)?.emit(
          'generation.image:progress',
          {
            frameId: input.frameId,
            status: 'completed',
            thumbnailUrl: result.url,
          }
        );

        console.log(
          '[ImageWorkflow]',
          `Image uploaded to storage: ${result.path}`
        );
        return { url: result.url, path: result.path };
      });
    }

    console.log('[ImageWorkflow]', 'Image generation workflow completed');

    // Return workflow result
    return {
      imageUrl,
      frameId: input.frameId,
      sequenceId: input.sequenceId,
    };
  },
  {
    flowControl: getFalFlowControl(),
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      // Set frame thumbnail status to 'failed' after all retries exhausted
      if (input.frameId) {
        await updateFrame(
          input.frameId,
          {
            thumbnailStatus: 'failed',
            thumbnailError: failResponse,
          },
          { throwOnMissing: false }
        );

        // Emit failure progress
        if (input.sequenceId) {
          try {
            await getGenerationChannel(input.sequenceId)?.emit(
              'generation.image:progress',
              {
                frameId: input.frameId,
                status: 'failed',
              }
            );
          } catch {
            // Ignore emit errors
          }
        }

        console.error(
          '[ImageWorkflow]',
          `Image generation failed for frame ${input.frameId}: ${failResponse}`
        );
      }

      return `Image generation failed for frame ${input.frameId}`;
    },
  }
);
