/**
 * Cloudflare Workflows prototype: Image Generation
 *
 * This is a proof-of-concept migration of the Upstash image workflow
 * to Cloudflare Workflows. It maps context.run() → step.do() with
 * the same step names and logic as the original.
 *
 * Key differences from Upstash:
 * - No flowControl (rate limiting) — deferred to production migration
 * - No failureFunction — replaced with try/catch in run()
 * - context.workflowRunId → event.instanceId
 * - context.requestPayload → event.payload
 */

import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';

import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/models';
import { DEFAULT_IMAGE_SIZE } from '@/lib/constants/aspect-ratios';
import { updateFrame } from '@/lib/db/helpers/frames';
import {
  generateImageWithProvider,
  type ImageGenerationParams,
} from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { isBillingEnabled } from '@/lib/billing/constants';
import { deductCredits, hasEnoughCredits } from '@/lib/billing/credit-service';
import { getGenerationChannel } from '@/lib/realtime';
import type { ImageWorkflowInput } from '@/lib/workflow/types';
import { buildReferenceImagePrompt } from '@/lib/prompts/reference-image-prompt';
import { resolveWorkflowApiKeys } from '@/lib/workflow/resolve-keys';

type ImageWorkflowResult = {
  imageUrl: string;
  frameId?: string;
  sequenceId?: string;
};

export class CfImageWorkflow extends WorkflowEntrypoint<
  Cloudflare.Env,
  ImageWorkflowInput
> {
  override async run(
    event: Readonly<WorkflowEvent<ImageWorkflowInput>>,
    step: WorkflowStep
  ): Promise<ImageWorkflowResult> {
    const input = event.payload;

    try {
      // Step 1: Set status to generating if frameId is provided
      const generationParams = await step.do(
        'set-generating-status',
        async () => {
          if (!input.prompt || input.prompt.trim().length === 0) {
            throw new NonRetryableError(
              'Prompt is required for image generation'
            );
          }

          console.log(
            '[CfImageWorkflow]',
            `Starting image generation workflow for user ${input.userId}`
          );

          const model = input.model || DEFAULT_IMAGE_MODEL;

          if (input.frameId) {
            const frame = await updateFrame(
              input.frameId,
              {
                thumbnailStatus: 'generating',
                thumbnailWorkflowRunId: event.instanceId,
                imageModel: model,
                imagePrompt: input.prompt,
              },
              { throwOnMissing: false }
            );

            if (!frame) {
              console.log(
                '[CfImageWorkflow]',
                `Frame ${input.frameId} was deleted, skipping workflow`
              );
              return null;
            }

            await getGenerationChannel(input.sequenceId)?.emit(
              'generation.image:progress',
              {
                frameId: input.frameId,
                status: 'generating',
              }
            );
          }

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
              input.referenceImages?.map(
                (image: { referenceImageUrl: string }) =>
                  image.referenceImageUrl
              ) ?? [],
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

      // Step 2: Resolve team API keys
      const apiKeys = await step.do('resolve-api-keys', async () => {
        return resolveWorkflowApiKeys(input.teamId);
      });

      // Step 3: Generate image (with retries)
      const imageResult = await step.do(
        'generate-image',
        {
          retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
          timeout: '5 minutes',
        },
        async () => {
          console.log(
            '[CfImageWorkflow]',
            `Generating image ${input.frameId} with model ${generationParams.model}`
          );

          return await generateImageWithProvider({
            ...generationParams,
            falApiKey: apiKeys.falApiKey,
          });
        }
      );

      // Step 4: Deduct credits (skip if team used own fal key)
      const imageCost =
        typeof imageResult.metadata.cost === 'number'
          ? imageResult.metadata.cost
          : 0;
      const { teamId } = input;
      if (isBillingEnabled() && imageCost > 0 && teamId && !apiKeys.falApiKey) {
        await step.do('deduct-credits', async () => {
          const canAfford = await hasEnoughCredits(teamId, imageCost);
          if (!canAfford) {
            console.warn(
              `[CfImageWorkflow] Insufficient credits for team ${teamId} (cost: $${imageCost.toFixed(4)}), skipping deduction`
            );
            return;
          }
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

      // Step 5: Upload to R2 storage
      let imageUrl: string = imageResult.imageUrls[0];
      const { frameId, sequenceId } = input;

      if (imageUrl && frameId && sequenceId && input.teamId) {
        await step.do('upload-to-storage', async () => {
          if (!frameId || !sequenceId || !input.teamId || !imageUrl) {
            throw new Error('Missing required IDs for storage upload', {
              cause: JSON.stringify(imageResult),
            });
          }

          const result = await uploadImageToStorage({
            imageUrl,
            teamId: input.teamId,
            sequenceId,
            frameId,
          });

          if (!result.url) {
            throw new Error('Failed to upload image to storage');
          }

          imageUrl = result.url;

          const updatedFrame = await updateFrame(
            frameId,
            {
              thumbnailPath: result.path || null,
              thumbnailUrl: result.url,
              thumbnailStatus: 'completed',
              thumbnailGeneratedAt: new Date(),
              thumbnailError: null,
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
              '[CfImageWorkflow]',
              `Frame ${frameId} was deleted, skipping final update`
            );
            return { url: result.url, path: result.path };
          }

          await getGenerationChannel(sequenceId)?.emit(
            'generation.image:progress',
            {
              frameId,
              status: 'completed',
              thumbnailUrl: result.url,
            }
          );

          console.log(
            '[CfImageWorkflow]',
            `Image uploaded to storage: ${result.path}`
          );
          return { url: result.url, path: result.path };
        });
      }

      console.log('[CfImageWorkflow]', 'Image generation workflow completed');

      return {
        imageUrl,
        frameId: input.frameId,
        sequenceId: input.sequenceId,
      };
    } catch (error) {
      // Replaces Upstash's failureFunction — update frame to failed status
      const { frameId } = input;
      if (frameId) {
        await step.do('handle-failure', async () => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await updateFrame(
            frameId,
            {
              thumbnailStatus: 'failed',
              thumbnailError: errorMessage,
            },
            { throwOnMissing: false }
          );

          if (input.sequenceId) {
            try {
              await getGenerationChannel(input.sequenceId)?.emit(
                'generation.image:progress',
                {
                  frameId,
                  status: 'failed',
                }
              );
            } catch {
              // Ignore emit errors in failure handler
            }
          }

          console.error(
            '[CfImageWorkflow]',
            `Image generation failed for frame ${frameId}: ${errorMessage}`
          );
        });
      }

      throw error;
    }
  }
}
