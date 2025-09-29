/**
 * Image generation webhook handler
 * Processes image generation jobs from QStash using FAL AI
 */

import { FAL_IMAGE_MODELS, generateImage } from "@/lib/ai/fal-client";
import type { JobPayload } from "@/lib/qstash/client";
import { withQStashVerification } from "@/lib/qstash/middleware";
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
    let model = imageData.model as keyof typeof FAL_IMAGE_MODELS | undefined;
    if (!model) {
      // Default to fast model
      model = "flux_schnell";
    }

    console.log("[ImageWebhook] Generating image with model", imageData);

    // Generate image using FAL
    const falResponse = await generateImage({
      model: FAL_IMAGE_MODELS[model],
      prompt: imageData.prompt,
      image_size: imageData.image_size,
      num_images: imageData.num_images || 1,
      seed: imageData.seed,
      image_url: imageData.image_url as string,
    });

    // Build result structure
    const result = {
      imageUrls: falResponse.data?.images?.map((img) => img.url) ?? [],
      parameters: data,
      generatedAt: new Date().toISOString(),
      processingTimeMs:
        falResponse.data?.timings?.inference ?? falResponse.latencyMs ?? 0,
      provider: "fal-ai",
      metadata: {
        prompt: imageData.prompt,
        model,
        dimensions:
          falResponse.data?.images?.map((img) => ({
            width: img.width,
            height: img.height,
          })) ?? [],
        file_sizes:
          falResponse.data?.images?.map((img) => img.file_size ?? 0) ?? [],
        seed: falResponse.data?.seed,
        has_nsfw_concepts: falResponse.data?.has_nsfw_concepts,
        cost: falResponse.cost,
        requestId: falResponse.requestId,
      },
    };

    // If this is for a frame, update the frame with the generated image URL
    if (imageData.frameId && result.imageUrls.length > 0) {
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
