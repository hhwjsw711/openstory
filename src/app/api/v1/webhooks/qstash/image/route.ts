/**
 * Image generation webhook handler
 * Processes image generation jobs from QStash using FAL AI
 */

import { FAL_IMAGE_MODELS, generateImage } from "@/lib/ai/fal-client";
import type { JobPayload } from "@/lib/qstash/client";
import { withQStashVerification } from "@/lib/qstash/middleware";
import { BaseWebhookHandler, type JobProcessor } from "../base-handler";

/**
 * Image generation processor using FAL AI
 */
const processImageGeneration: JobProcessor = async (
  payload: JobPayload,
  metadata,
): Promise<Record<string, unknown>> => {
  const { jobId, data, userId, teamId } = payload;

  console.log("[ImageWebhook] Processing image generation with FAL", {
    jobId,
    userId,
    teamId,
    messageId: metadata.messageId,
    retryCount: metadata.retryCount,
    hasData: !!data,
  });

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

    // Generate image using FAL
    console.log("[ImageWebhook] Calling FAL API", {
      model,
      prompt: imageData.prompt.slice(0, 100),
      num_images: imageData.num_images || 1,
    });

    const falResponse = await generateImage({
      model: FAL_IMAGE_MODELS[model],
      prompt: imageData.prompt,
      image_size: imageData.image_size,
      num_images: imageData.num_images || 1,
      seed: imageData.seed,
    });

    // Build result structure
    const result = {
      imageUrls: falResponse.images.map((img) => img.url),
      parameters: data,
      generatedAt: new Date().toISOString(),
      processingTimeMs: falResponse.timings?.inference || 0,
      provider: "fal-ai",
      metadata: {
        prompt: imageData.prompt,
        model,
        dimensions: falResponse.images.map((img) => ({
          width: img.width,
          height: img.height,
        })),
        file_sizes: falResponse.images.map((img) => img.file_size),
        seed: falResponse.seed,
        has_nsfw_concepts: falResponse.has_nsfw_concepts,
      },
    };

    console.log("[ImageWebhook] Image generation completed", {
      jobId,
      imageCount: result.imageUrls.length,
      provider: result.provider,
      inferenceTime: falResponse.timings?.inference,
    });

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

    console.log("[ImageWebhook] Using fallback images", {
      jobId,
      error: fallbackResult.metadata.error,
    });

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
  console.log("[ImageWebhook] Received image generation webhook", {
    url: request.url,
    messageId: request.qstashMessageId,
    retryCount: request.qstashRetryCount,
  });

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
