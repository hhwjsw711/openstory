import { deductWorkflowCredits } from '@/lib/billing/workflow-deduction';
import { updateFrame } from '@/lib/db/helpers/frames';
import { generateImageWithProvider } from '@/lib/image/image-generation';
import { uploadImageToStorage } from '@/lib/image/image-storage';
import { getGenerationChannel } from '@/lib/realtime';
import type {
  UpscaleVariantWorkflowInput,
  UpscaleVariantWorkflowResult,
} from '@/lib/workflow/types';
import type { WorkflowContext } from '@upstash/workflow';
import { createWorkflow } from '@upstash/workflow/tanstack';

const UPSCALE_PROMPT = `Upscale this image to a clean, high-resolution frame suitable for animation.

RENDERING RULES
- Keep the original scene, pose, framing and camera angle IDENTICAL.
- Preserve the identity of all real people:
  - Do NOT change their faces, expressions, hairstyles, or clothing.
  - Do NOT add new people or remove existing people.
- Faces:
  - Make faces sharp and detailed.
  - Clear eyes, natural skin texture, no plastic or over-smoothed look.
- Text & logos:
  - Preserve all printed text, signage, and logos exactly as they appear.
  - Re-render text cleanly at higher resolution.
  - Do NOT invent new words, change names, or move signs.
- Style:
  - Realistic photographic look.
  - Keep original colours, lighting and depth of field.
  - No extra filters, bokeh, vignettes, film grain, or stylistic changes unless they already exist.

OUTPUT
- A SINGLE high-resolution image.
- Aspect ratio: match the original exactly.
- Resolution: upscale to animation-ready quality.
- No text overlays, borders, watermarks, or new graphics added by the model.`;

export const upscaleVariantWorkflow = createWorkflow(
  async (context: WorkflowContext<UpscaleVariantWorkflowInput>) => {
    const input = context.requestPayload;

    console.log(
      '[UpscaleVariantWorkflow]',
      `Starting upscale for frame ${input.frameId}`
    );

    const upscaleResult = await context.run('upscale-image', async () => {
      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        { frameId: input.frameId, status: 'generating' }
      );

      const frame = await updateFrame(
        input.frameId,
        {
          thumbnailStatus: 'generating',
          thumbnailWorkflowRunId: context.workflowRunId,
        },
        { throwOnMissing: false }
      );

      if (!frame) {
        console.log(
          '[UpscaleVariantWorkflow]',
          `Frame ${input.frameId} was deleted, skipping workflow`
        );
        return null;
      }

      const result = await generateImageWithProvider({
        model: 'nano_banana_pro',
        prompt: UPSCALE_PROMPT,
        referenceImageUrls: [input.croppedTileUrl],
        numImages: 1,
        outputFormat: 'png',
        teamId: input.teamId,
      });
      return {
        imageUrl: result.imageUrls[0],
        cost: result.metadata.cost ?? 0,
        usedOwnKey: result.metadata.usedOwnKey,
      };
    });

    if (!upscaleResult) {
      return { upscaledUrl: '', upscaledPath: '' };
    }

    await context.run('deduct-credits', async () => {
      await deductWorkflowCredits({
        teamId: input.teamId,
        costUsd: upscaleResult.cost,
        usedOwnKey: upscaleResult.usedOwnKey,
        userId: input.userId,
        description: 'Variant upscale (nano_banana_pro)',
        metadata: { frameId: input.frameId, sequenceId: input.sequenceId },
        workflowName: 'UpscaleVariantWorkflow',
      });
    });

    const storageResult = await context.run('upload-to-storage', async () => {
      const result = await uploadImageToStorage({
        imageUrl: upscaleResult.imageUrl,
        teamId: input.teamId,
        sequenceId: input.sequenceId,
        frameId: input.frameId,
      });

      if (!result.url) {
        throw new Error('Failed to upload upscaled image to storage');
      }

      return { url: result.url, path: result.path };
    });

    await context.run('update-frame', async () => {
      const updatedFrame = await updateFrame(
        input.frameId,
        {
          thumbnailUrl: storageResult.url,
          thumbnailPath: storageResult.path || null,
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
        },
        { throwOnMissing: false }
      );

      if (!updatedFrame) {
        console.log(
          '[UpscaleVariantWorkflow]',
          `Frame ${input.frameId} was deleted, skipping final update`
        );
        return;
      }

      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        {
          frameId: input.frameId,
          status: 'completed',
          thumbnailUrl: storageResult.url,
        }
      );

      console.log(
        '[UpscaleVariantWorkflow]',
        `Upscale completed for frame ${input.frameId}`
      );
    });

    return {
      upscaledUrl: storageResult.url,
      upscaledPath: storageResult.path || '',
    } satisfies UpscaleVariantWorkflowResult;
  },
  {
    failureFunction: async ({ context, failResponse }) => {
      const input = context.requestPayload;

      console.error(
        '[UpscaleVariantWorkflow]',
        `Upscale failed for frame ${input.frameId}: ${failResponse}`
      );

      await updateFrame(
        input.frameId,
        {
          thumbnailStatus: 'completed',
          thumbnailGeneratedAt: new Date(),
        },
        { throwOnMissing: false }
      );

      await getGenerationChannel(input.sequenceId).emit(
        'generation.image:progress',
        { frameId: input.frameId, status: 'completed' }
      );

      return `Upscale failed for frame ${input.frameId}`;
    },
  }
);
