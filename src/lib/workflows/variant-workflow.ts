import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { getGenerationChannel } from '@/lib/realtime';
import type {
  VariantWorkflowInput,
  VariantWorkflowResult,
} from '@/lib/workflow/types';
import { WorkflowValidationError } from '@/lib/workflow/errors';
import { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';
import { getVariantImagePrompt } from '@/lib/prompts/variant-image';
import {
  buildReferenceImagePrompt,
  type ReferenceImageDescription,
} from '@/lib/prompts/reference-image-prompt';

export const generateVariantWorkflow = createWorkflow(
  async (context: WorkflowContext<VariantWorkflowInput>) => {
    const input = context.requestPayload;

    // Guard against undefined payload (can happen with stale workflow retries)
    if (!input) {
      throw new WorkflowValidationError(
        'Invalid workflow payload: requestPayload is undefined'
      );
    }

    // Step 1: Set status to generating if frameId is provided
    const generationParams: ImageGenerationParams | null = await context.run(
      'set-generating-status',
      async () => {
        // Validate required fields
        if (!input.thumbnailUrl || input.thumbnailUrl.trim().length === 0) {
          throw new WorkflowValidationError(
            'Thumbnail URL is required for variant image generation'
          );
        }

        console.log(
          '[VariantWorkflow]',
          `Starting variant image generation workflow for user ${input.userId}`
        );

        const model = input.model || DEFAULT_IMAGE_MODEL;
        const imageSize = input.imageSize ?? DEFAULT_IMAGE_SIZE;

        if (input.frameId) {
          // update frame status to generating and store user prompt
          const frame = await updateFrame(
            input.frameId,
            {
              variantImageStatus: 'generating',
            },
            { throwOnMissing: false }
          );

          if (!frame) {
            console.log(
              '[VariantWorkflow]',
              `Frame ${input.frameId} was deleted, skipping workflow`
            );
            return null; // Signal to skip
          }

          // Emit realtime progress
          await getGenerationChannel(input.sequenceId)?.emit(
            'generation.variant-image:progress',
            {
              frameId: input.frameId,
              status: 'generating',
            }
          );
        }

        // Combine all references: thumbnail + characters + locations
        const basePrompt = getVariantImagePrompt(imageSize);
        const allReferences: ReferenceImageDescription[] = [
          {
            referenceImageUrl: input.thumbnailUrl,
            description: 'Source image to create variants from',
          },
          ...(input.characterReferences ?? []),
          ...(input.locationReferences ?? []),
        ];

        const { prompt: enhancedPrompt, referenceUrls } =
          buildReferenceImagePrompt(basePrompt, allReferences);

        // Return the generation params so it shows in the workflow context for debugging
        return {
          model,
          prompt: enhancedPrompt,
          imageSize,
          numImages: input.numImages ?? 1,
          seed: input.seed,
          referenceImageUrls: referenceUrls,
          traceName: 'variant-image',
        };
      }
    );

    // Early exit if frame was deleted
    if (!generationParams) {
      return { variantImageUrl: '' };
    }

    // Step 2: Generate image
    const imageResult = await context.run('generate-image', async () => {
      console.log(
        '[VariantWorkflow]',
        `Generating variant image ${input.frameId} with model ${generationParams.model}`
      );

      return await generateImageWithProvider(generationParams);
    });

    let imageUrl: string = imageResult.imageUrls[0];

    if (input.frameId && input.sequenceId && input.teamId) {
      await context.run('upload-to-storage', async () => {
        if (
          !input.frameId ||
          !input.sequenceId ||
          !input.teamId ||
          !imageResult.imageUrls[0]
        ) {
          throw new Error('Missing required IDs for storage upload', {
            cause: JSON.stringify(imageResult),
          });
        }

        const result = await uploadImageToStorage({
          imageUrl: imageResult.imageUrls[0],
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
            variantImageUrl: result.url, // Store public URL (permanent, not signed)
            variantImageStatus: 'completed',
          },
          { throwOnMissing: false }
        );

        if (!updatedFrame) {
          console.log(
            '[VariantWorkflow]',
            `Frame ${input.frameId} was deleted, skipping final update`
          );
          return { url: result.url, path: result.path };
        }

        // Emit completion progress
        await getGenerationChannel(input.sequenceId)?.emit(
          'generation.variant-image:progress',
          {
            frameId: input.frameId,
            status: 'completed',
            variantImageUrl: result.url,
          }
        );

        console.log(
          '[VariantWorkflow]',
          `Image uploaded to storage: ${result.path}`
        );
        return { url: result.url, path: result.path };
      });
    }

    console.log('[VariantWorkflow]', 'Image generation workflow completed');

    // Return workflow result
    const result: VariantWorkflowResult = {
      variantImageUrl: imageUrl,
    };

    return result;
  },
  {
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
              'generation.variant-image:progress',
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
          '[VariantWorkflow]',
          `Image generation failed for frame ${input.frameId}: ${failResponse}`
        );
      }

      return `Image generation failed for frame ${input.frameId}`;
    },
  }
);
