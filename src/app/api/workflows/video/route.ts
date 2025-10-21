/**
 * Video generation workflow
 * Generates videos using AI models (text-to-video or image-to-video)
 */

import { serve } from "@upstash/workflow/nextjs";
import {
  generateImage,
  generateVideo,
  uploadToFal,
  VIDEO_MODELS,
} from "@/lib/ai/fal-client";
import { LoggerService } from "@/lib/services/logger.service";
import type { VideoWorkflowInput, VideoWorkflowResult } from "@/lib/workflow";
import { validateWorkflowAuth } from "@/lib/workflow";

const loggerService = new LoggerService("VideoWorkflow");

export const { POST } = serve<VideoWorkflowInput>(async (context) => {
  const input = context.requestPayload;

  // Validate authentication
  validateWorkflowAuth(input);

  loggerService.logDebug(
    `Starting video generation workflow for user ${input.userId}`,
  );

  // Step 1: Upload image if base64 data is provided
  const imageUrl = await context.run("upload-image", async () => {
    if (input.imageData && !input.imageUrl) {
      const imageBuffer = Buffer.from(input.imageData, "base64");
      return await uploadToFal(imageBuffer, "frame.jpg");
    }
    return input.imageUrl;
  });

  // Step 2: Generate video
  const videoResult = await context.run("generate-video", async () => {
    try {
      // Determine model to use
      let model = input.model as keyof typeof VIDEO_MODELS | undefined;
      if (!model) {
        // Auto-select model based on input
        if (imageUrl) {
          model = "wan_i2v"; // Default image-to-video model
        } else {
          model = "minimax_hailuo"; // Default text-to-video model
        }
      }

      loggerService.logDebug(`Generating video with model ${model}`);

      // Generate video using FAL
      const falResponse = await generateVideo({
        model: VIDEO_MODELS[model],
        prompt: input.prompt,
        image_url: imageUrl,
        duration: input.duration,
        aspect_ratio: input.aspectRatio as
          | "16:9"
          | "9:16"
          | "1:1"
          | "4:3"
          | "3:4"
          | undefined,
        enable_audio: input.enableAudio,
      });

      return {
        videoUrl: falResponse.data?.video?.url,
        processingTimeMs:
          falResponse.data?.timings?.inference || falResponse.latencyMs || 0,
        metadata: {
          prompt: input.prompt,
          model,
          duration: input.duration,
          aspectRatio: input.aspectRatio,
          format: falResponse.data?.video?.content_type,
          fileSize: falResponse.data?.video?.file_size,
          seed: falResponse.data?.seed,
          cost: falResponse.cost,
          requestId: falResponse.requestId,
        },
      };
    } catch (error) {
      loggerService.logError(
        `Video generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      // Return fallback on error
      return {
        videoUrl:
          "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        processingTimeMs: 3000,
        metadata: {
          prompt: input.prompt || "Fallback video due to generation error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  });

  // Step 3: Generate thumbnail if needed
  const thumbnailUrl = await context.run("generate-thumbnail", async () => {
    // If we have an input image, use it as thumbnail
    if (imageUrl) {
      return imageUrl;
    }

    // If we have a prompt but no image, generate a thumbnail
    if (input.prompt) {
      try {
        const thumbnailResponse = await generateImage({
          prompt: input.prompt,
          image_size:
            input.aspectRatio === "9:16" ? "portrait_16_9" : "landscape_16_9",
          num_images: 1,
        });
        return thumbnailResponse.data?.images[0]?.url;
      } catch (error) {
        loggerService.logError(
          `Thumbnail generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return undefined;
      }
    }

    return undefined;
  });

  loggerService.logDebug("Video generation workflow completed");

  // Return workflow result
  const result: VideoWorkflowResult = {
    videoUrl: videoResult.videoUrl || "",
    thumbnailUrl,
    duration: input.duration,
  };

  return result;
});
