/**
 * Image generation workflow
 * Generates images using AI models and optionally updates frame thumbnails
 */

import { serve } from "@upstash/workflow/nextjs";
import {
  type FalImageGenerationParams,
  type FalImageResponse,
  generateImage as generateImageFal,
  IMAGE_MODELS,
} from "@/lib/ai/fal-client";
import type { LetzAIMode } from "@/lib/ai/letzai-client";
import { generateImage as generateImageLetzAI } from "@/lib/ai/letzai-client";
import { AI_PROVIDER_MAPPINGS } from "@/lib/ai/models";
import type {
  LetzAIImageRequest,
  LetzAIImageResponse,
} from "@/lib/schemas/letzai-request";
import { LoggerService } from "@/lib/services/logger.service";
import { createAdminClient } from "@/lib/supabase/server";
import type { ImageWorkflowInput, ImageWorkflowResult } from "@/lib/workflow";
import { validateWorkflowAuth } from "@/lib/workflow";

const loggerService = new LoggerService("ImageWorkflow");

const LETZAI_PRESET_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  square_hd: { width: 1024, height: 1024 },
  square: { width: 768, height: 768 },
  portrait_4_3: { width: 672, height: 896 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1600, height: 900 },
} as const;

export const { POST } = serve<ImageWorkflowInput>(async (context) => {
  const input = context.requestPayload;

  // Validate authentication
  validateWorkflowAuth(input);

  loggerService.logDebug(
    `Starting image generation workflow for user ${input.userId}`,
  );

  // Step 1: Generate image
  const imageResult = await context.run("generate-image", async () => {
    if (!input.prompt) {
      throw new Error("Prompt is required for image generation");
    }

    try {
      // Determine model to use
      let model = input.model as keyof typeof IMAGE_MODELS | undefined;
      if (!model) model = "flux_krea_lora"; // Default to fast model

      loggerService.logDebug(
        `Generating image ${input.frameId} with model ${model}`,
      );

      // Generate image using selected AI provider
      const resp = await selectedAiProvider({
        model: IMAGE_MODELS[model],
        prompt: input.prompt,
        image_size: input.imageSize,
        num_images: input.numImages || 1,
        seed: input.seed,
      });

      const respData = resp.data as unknown as
        | FalImageResponse
        | LetzAIImageResponse;
      const result = resultByProvider(
        model,
        input as unknown as Record<string, unknown>,
        respData,
      );

      return result;
    } catch (error) {
      loggerService.logError(
        `Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      // Return fallback on error
      return {
        imageUrls: [
          `https://picsum.photos/seed/1/1024/1024`,
          `https://picsum.photos/seed/2/1024/1024`,
        ],
        parameters: input,
        generatedAt: new Date().toISOString(),
        processingTimeMs: 1000,
        provider: "mock-fallback",
        metadata: {
          prompt: input.prompt || "Fallback image due to generation error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  });

  // Step 2: Update frame if frameId is provided
  if (input.frameId && imageResult.imageUrls.length > 0) {
    await context.run("update-frame", async () => {
      if (!input.frameId) {
        throw new Error("frameId is required for update-frame step");
      }

      const supabase = createAdminClient();
      const { error: updateError } = await supabase
        .from("frames")
        .update({
          thumbnail_url: imageResult.imageUrls[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.frameId);

      if (updateError) {
        loggerService.logError(
          `Failed to update frame ${input.frameId} with image URL: ${updateError.message}`,
        );
        throw updateError;
      }

      return { updated: true };
    });

    // Step 3: Check if all frames are complete and update sequence
    if (input.sequenceId) {
      await context.run("update-sequence-status", async () => {
        if (!input.sequenceId) {
          throw new Error(
            "sequenceId is required for update-sequence-status step",
          );
        }

        const supabase = createAdminClient();

        // Check if all frames for this sequence now have thumbnails
        const { data: allFrames } = await supabase
          .from("frames")
          .select("id, thumbnail_url")
          .eq("sequence_id", input.sequenceId);

        if (allFrames) {
          const framesWithThumbnails = allFrames.filter(
            (frame) => frame.thumbnail_url,
          );
          const allFramesHaveThumbnails =
            framesWithThumbnails.length === allFrames.length;

          if (allFramesHaveThumbnails && allFrames.length > 0) {
            const { data: sequence } = await supabase
              .from("sequences")
              .select("metadata")
              .eq("id", input.sequenceId)
              .single();

            if (sequence) {
              const existingMetadata =
                (sequence.metadata as Record<string, unknown>) || {};
              const frameGeneration =
                (existingMetadata.frameGeneration as Record<string, unknown>) ||
                {};

              const updatedMetadata = {
                ...existingMetadata,
                frameGeneration: {
                  ...frameGeneration,
                  status: "completed",
                  completedAt: new Date().toISOString(),
                  thumbnailsGenerating: false,
                },
              };

              const { error: seqUpdateError } = await supabase
                .from("sequences")
                .update({
                  metadata: updatedMetadata,
                  status: "completed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", input.sequenceId);

              if (seqUpdateError) {
                loggerService.logError(
                  `Failed to update sequence ${input.sequenceId}: ${seqUpdateError.message}`,
                );
              }
            }
          }
        }

        return { updated: true };
      });
    }
  }

  loggerService.logDebug("Image generation workflow completed");

  // Return workflow result
  const result: ImageWorkflowResult = {
    imageUrl: imageResult.imageUrls[0],
    thumbnailUrl: imageResult.imageUrls[0],
    frameId: input.frameId,
    sequenceId: input.sequenceId,
  };

  return result;
});

/**
 * Select AI provider based on model
 */
function selectedAiProvider(payload: Record<string, unknown>) {
  switch (payload.model) {
    case "letzai/image": {
      const sizePreset = payload.image_size as string | undefined;
      const { width, height } = LETZAI_PRESET_DIMENSIONS[
        sizePreset ?? "landscape_16_9"
      ] ?? {
        width: 1600,
        height: 900,
      };
      const letzaiPayload = {
        prompt: payload.prompt as string,
        width,
        height,
        quality: payload.quality || (5 as number),
        creativity: payload.creativity || (2 as number),
        hasWatermark: payload.hasWatermark || (false as boolean),
        systemVersion: payload.systemVersion || (3 as number),
        mode: (payload.mode as LetzAIMode) || "cinematic",
      } as LetzAIImageRequest;
      return generateImageLetzAI(letzaiPayload);
    }
    default:
      return generateImageFal(payload as unknown as FalImageGenerationParams);
  }
}

/**
 * Parse result by provider
 */
function resultByProvider(
  model: string,
  data: Record<string, unknown>,
  resp: FalImageResponse | LetzAIImageResponse,
) {
  const result = {
    imageUrls: [] as string[],
    parameters: data,
    generatedAt: new Date().toISOString(),
    processingTimeMs: 0,
    provider: AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS],
    metadata: {
      prompt: resp.prompt,
      model,
      dimensions: [] as { width: number; height: number }[],
      file_sizes: [] as number[],
      seed: (resp as { seed?: number }).seed,
      has_nsfw_concepts: (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts,
      cost: (resp as { cost?: number }).cost,
      requestId: (resp as { requestId?: string }).requestId,
    },
  };

  switch (AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS]) {
    case "letz-ai": {
      const generationSettings =
        (resp as { generationSettings?: Record<string, number> })
          .generationSettings ?? ({} as Record<string, number>);
      const reqDims = {
        width: (data as { width?: number }).width,
        height: (data as { height?: number }).height,
      };
      result.imageUrls = [
        (resp as { imageVersions?: { original: string } }).imageVersions
          ?.original as string,
      ];
      result.processingTimeMs = (resp as { latencyMs?: number }).latencyMs || 0;
      result.metadata.dimensions = [
        {
          width: generationSettings.width ?? reqDims.width ?? 1600,
          height: generationSettings.height ?? reqDims.height ?? 900,
        },
      ];
      break;
    }
    default: {
      const images = (
        resp as {
          images?: {
            url: string;
            width?: number;
            height?: number;
            file_size?: number;
          }[];
        }
      ).images;
      const timings = (resp as { timings?: { inference?: number } }).timings;
      const latencyMs = (resp as { latencyMs?: number }).latencyMs;
      const seed = (resp as { seed?: number }).seed;
      const has_nsfw_concepts = (resp as { has_nsfw_concepts?: boolean[] })
        .has_nsfw_concepts;

      result.imageUrls = Array.isArray(images)
        ? images.map((img: { url: string }) => img.url)
        : ([] as string[]);
      result.processingTimeMs = timings?.inference || latencyMs || 0;
      result.metadata.dimensions = Array.isArray(images)
        ? images.map((img: { width?: number; height?: number }) => ({
            width: img.width ?? 0,
            height: img.height ?? 0,
          }))
        : ([] as { width: number; height: number }[]);
      result.metadata.file_sizes = Array.isArray(images)
        ? images.map((img: { file_size?: number }) => img.file_size ?? 0)
        : ([] as number[]);
      result.metadata.seed = seed;
      result.metadata.has_nsfw_concepts = has_nsfw_concepts;
      break;
    }
  }

  return result;
}
