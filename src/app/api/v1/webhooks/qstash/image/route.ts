/**
 * Image generation webhook handler
 * Processes image generation jobs from QStash using FAL AI
 */

import {
  type FalImageGenerationParams,
  type FalImageResponse,
  generateImage as generateImageFal,
  IMAGE_MODELS,
} from "@/lib/ai/fal-client";
import type { LetzAIMode } from "@/lib/ai/letzai-client";
import { generateImage as generateImageLetzAI } from "@/lib/ai/letzai-client";
import { AI_PROVIDER_MAPPINGS } from "@/lib/ai/models";
import type { JobPayload } from "@/lib/qstash/client";
import { withQStashVerification } from "@/lib/qstash/middleware";
import type {
  LetzAIImageRequest,
  LetzAIImageResponse,
} from "@/lib/schemas/letzai-request";
import { createAdminClient } from "@/lib/supabase/server";
import { BaseWebhookHandler, type JobProcessor } from "../base-handler";

/**
 * Image generation processor using FAL AI
 */
const processImageGeneration: JobProcessor = async (
  payload: JobPayload,
  _metadata,
): Promise<Record<string, unknown>> => {
  const { data } = payload;

  // Type assertion for image generation data
  const imageData = data as {
    prompt?: string;
    model?: string;
    image_size?:
      | "square_hd"
      | "square"
      | "portrait_4_3"
      | "portrait_16_9"
      | "landscape_4_3"
      | "landscape_16_9";
    num_images?: number;
    style?: unknown;
    seed?: number;
    frameId?: string;
    sequenceId?: string;
    [key: string]: unknown;
  };

  if (!imageData.prompt) {
    throw new Error("Prompt is required for image generation");
  }

  try {
    // Determine model to use
    let model = imageData.model as keyof typeof IMAGE_MODELS | undefined;
    if (!model) {
      // Default to fast model
      model = "flux_schnell";
    }

    if (process.env.NODE_ENV !== "production") {
      const { prompt, image_url, ...rest } = imageData as Record<
        string,
        unknown
      >;
      console.debug("[ImageWebhook] Generating image", {
        ...rest,
        prompt: prompt ? "[redacted]" : undefined,
        image_url: image_url ? "[redacted]" : undefined,
      });
    }

    // Generate image using selected AI provider
    const resp = await selectedAiProvider({
      model: IMAGE_MODELS[model],
      prompt: imageData.prompt,
      image_size: imageData.image_size,
      num_images: imageData.num_images || 1,
      seed: imageData.seed,
      image_url: imageData.image_url as string,
    });

    const result = resultByProvider(model, imageData, resp.data as any);

    // If this is for a frame, update the frame with the generated image URL
    if (imageData.frameId && result?.imageUrls.length > 0) {
      const supabase = createAdminClient();
      const { error: updateError } = await supabase
        .from("frames")
        .update({
          thumbnail_url: result.imageUrls[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", imageData.frameId);

      if (updateError) {
        console.error("[ImageWebhook] Failed to update frame with image URL", {
          frameId: imageData.frameId,
          error: updateError.message,
        });
        return result;
      }

      const { data: frameData } = await supabase
        .from("frames")
        .select("sequence_id")
        .eq("id", imageData.frameId)
        .single();

      if (frameData?.sequence_id) {
        // Check if all frames for this sequence now have thumbnails
        const { data: allFrames } = await supabase
          .from("frames")
          .select("id, thumbnail_url")
          .eq("sequence_id", frameData.sequence_id);

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
              .eq("id", frameData.sequence_id)
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
                  updated_at: new Date().toISOString(),
                })
                .eq("id", frameData.sequence_id);

              if (seqUpdateError) {
                console.error(
                  "[ImageWebhook] Failed to update sequence metadata",
                  {
                    sequenceId: frameData.sequence_id,
                    error: seqUpdateError.message,
                  },
                );
              }
            }
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("[ImageWebhook] Image generation failed", error);

    // Return mock fallback on error
    const fallbackResult = {
      imageUrls: [
        `https://picsum.photos/seed/1/1024/1024`,
        `https://picsum.photos/seed/2/1024/1024`,
      ],
      parameters: data,
      generatedAt: new Date().toISOString(),
      processingTimeMs: 1000,
      provider: "mock-fallback",
      metadata: {
        prompt: imageData.prompt || "Fallback image due to generation error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };

    // If this is for a frame, update the frame with the fallback image URL
    if (imageData.frameId && fallbackResult.imageUrls.length > 0) {
      const supabase = createAdminClient();
      const { error: updateError } = await supabase
        .from("frames")
        .update({
          thumbnail_url: fallbackResult.imageUrls[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", imageData.frameId);

      if (updateError) {
        console.error(
          "[ImageWebhook] Failed to update frame with fallback image URL",
          {
            frameId: imageData.frameId,
            error: updateError.message,
          },
        );
      }
    }

    return fallbackResult;
  }
};

/**
 * Image webhook handler
 */
const imageWebhookHandler = new BaseWebhookHandler();

/**
 * POST handler for image generation webhooks
 */
export const POST = withQStashVerification(async (request) => {
  return imageWebhookHandler.processWebhook(request, processImageGeneration);
});

/**
 * GET handler for webhook testing
 */
export async function GET() {
  return Response.json({
    message: "Image generation webhook endpoint",
    timestamp: new Date().toISOString(),
    status: "active",
  });
}

/**
 * private function to select AI provider based on model
 */
function selectedAiProvider(payload: Record<string, unknown>) {
  switch (payload.model) {
    case "letzai/image": {
      const letzaiPayload = {
        prompt: payload.prompt as string,
        width: payload.width as number,
        height: payload.height as number,
        quality: payload.quality as number,
        creativity: payload.creativity as number,
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

function resultByProvider(
  model: string,
  data: Record<string, unknown>,
  resp: Record<string, FalImageResponse | LetzAIImageResponse>,
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
      seed: resp.seed,
      has_nsfw_concepts: resp.has_nsfw_concepts,
      cost: (resp as any).cost,
      requestId: resp.requestId,
    },
  };

  switch (AI_PROVIDER_MAPPINGS[model as keyof typeof AI_PROVIDER_MAPPINGS]) {
    case "letz-ai": {
      const generationSettings = (resp as any).generationSettings as Record<
        string,
        number
      >;
      result.imageUrls = [(resp as any).imageVersions?.original as string];
      result.processingTimeMs = (resp as any).latencyMs || 0;
      result.metadata.dimensions = [
        { width: generationSettings.width, height: generationSettings.height },
      ];
      break;
    }
    default:
      result.imageUrls = Array.isArray(resp.images)
        ? resp.images.map((img: { url: string }) => img.url)
        : ([] as string[]);
      result.processingTimeMs = ((resp.timings as { inference?: number })
        ?.inference ||
        resp.latencyMs ||
        0) as number;
      result.metadata.dimensions = Array.isArray(resp.images)
        ? resp.images.map((img: { width?: number; height?: number }) => ({
            width: img.width ?? 0,
            height: img.height ?? 0,
          }))
        : ([] as { width: number; height: number }[]);
      result.metadata.file_sizes = Array.isArray(resp.images)
        ? resp.images.map((img: { file_size?: number }) => img.file_size ?? 0)
        : ([] as number[]);
      break;
  }

  return result;
}
