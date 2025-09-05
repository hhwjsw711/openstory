/**
 * QStash webhook handler for frame generation jobs
 *
 * NOTE: This webhook is now primarily used for legacy compatibility
 * and special frame regeneration cases. The main frame generation
 * flow now happens synchronously in generateFramesAction with only
 * image generation being async.
 */

import { generateFrameDescriptions } from "@/lib/ai/frame-generator";
import { analyzeScriptForFrames } from "@/lib/ai/script-analyzer";
import type { JobPayload } from "@/lib/qstash/client";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager } from "@/lib/qstash/job-manager";
import { withQStashVerification } from "@/lib/qstash/middleware";
import type {
  FrameGenerationPayload,
  FrameGenerationResult,
} from "@/lib/qstash/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { FrameInsert, Json } from "@/types/database";
import { BaseWebhookHandler, type JobProcessor } from "../base-handler";

/**
 * Frame generation processor
 * Handles the actual frame generation logic
 */
const processFrameGeneration: JobProcessor = async (
  payload: JobPayload,
  metadata,
): Promise<Record<string, unknown>> => {
  const jobManager = getJobManager();
  const supabase = createAdminClient();

  // Type assertion for frame generation payload
  const framePayload = payload as FrameGenerationPayload;
  const { jobId, data } = framePayload;

  console.log("[Frames Webhook] Processing job:", {
    jobId,
    sequenceId: data.sequenceId,
    options: data.options,
    messageId: metadata.messageId,
    retryCount: metadata.retryCount,
  });

  // Get stored job for authorization
  const storedJob = await jobManager.getJob(jobId);

  if (!storedJob) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Step 1: Load sequence data from database
  console.log("[Frames Webhook] Loading sequence data from database");
  const { data: sequence, error: sequenceError } = await supabase
    .from("sequences")
    .select("*, styles(*)")
    .eq("id", data.sequenceId)
    .single();

  if (sequenceError || !sequence) {
    throw new Error(`Sequence not found: ${data.sequenceId}`);
  }

  // Step 2: Verify team authorization
  // Check that the job's team_id matches the sequence's team_id
  if (storedJob.team_id && sequence.team_id !== storedJob.team_id) {
    console.error("[Frames Webhook] Team ID mismatch - unauthorized access", {
      jobTeamId: storedJob.team_id,
      sequenceTeamId: sequence.team_id,
      jobId,
      sequenceId: data.sequenceId,
    });
    throw new Error("Unauthorized: Team ID mismatch");
  }

  // Additional check: if job has a userId, verify it exists in the team
  if (storedJob.user_id && storedJob.team_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", storedJob.team_id)
      .eq("user_id", storedJob.user_id)
      .single();

    if (!member) {
      console.error("[Frames Webhook] User not a team member - unauthorized", {
        userId: storedJob.user_id,
        teamId: storedJob.team_id,
        jobId,
      });
      throw new Error("Unauthorized: User not a team member");
    }
  }

  if (!sequence.script) {
    throw new Error("Sequence has no script");
  }

  if (!sequence.style_id) {
    throw new Error("Sequence has no style selected");
  }

  // Step 3: Analyze script to determine frame boundaries
  console.log("[Frames Webhook] Analyzing script for scenes");
  const scriptAnalysis = await analyzeScriptForFrames(
    sequence.script,
    data.options?.aiProvider,
  );

  if (!scriptAnalysis?.scenes || scriptAnalysis.scenes.length === 0) {
    throw new Error("Failed to analyze script or no scenes found");
  }

  // Step 4: Generate frame descriptions for each scene
  console.log("[Frames Webhook] Generating frame descriptions", {
    sceneCount: scriptAnalysis.scenes.length,
    framesPerScene: data.options?.framesPerScene ?? 5,
  });

  // Get style metadata if styles were loaded
  let styleStack: unknown;
  if (sequence.styles && typeof sequence.styles === "object") {
    // Type assertion since Supabase doesn't give us perfect types for joins
    const style = sequence.styles as { metadata?: unknown };
    styleStack = style.metadata;
  }

  const frameDescriptions = await generateFrameDescriptions({
    script: sequence.script,
    scriptAnalysis,
    styleStack: styleStack as Json | undefined,
    framesPerScene: data.options?.framesPerScene ?? 5,
    aiProvider: data.options?.aiProvider,
  });

  if (!frameDescriptions?.frames || frameDescriptions.frames.length === 0) {
    throw new Error("Failed to generate frame descriptions");
  }

  // Step 5: Handle existing frames
  // Check if we should regenerate all frames or just missing ones
  const regenerateAll = data.options?.regenerateAll !== false; // Default to true

  if (regenerateAll) {
    // Delete ALL existing frames for this sequence to avoid conflicts
    const { error: deleteError } = await supabase
      .from("frames")
      .delete()
      .eq("sequence_id", data.sequenceId);

    if (deleteError) {
      console.warn(
        "[Frames Webhook] Failed to delete existing frames:",
        deleteError,
      );
    } else {
      console.log("[Frames Webhook] Deleted existing frames for sequence", {
        sequenceId: data.sequenceId,
      });
    }
  } else {
    // Only delete frames with matching jobId (placeholder frames)
    const { data: existingFrames } = await supabase
      .from("frames")
      .select("id, metadata")
      .eq("sequence_id", data.sequenceId);

    if (existingFrames && existingFrames.length > 0) {
      const framesToDelete = existingFrames
        .filter((frame) => {
          const metadata = frame.metadata as Record<string, unknown> | null;
          return metadata?.jobId === jobId;
        })
        .map((frame) => frame.id);

      if (framesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("frames")
          .delete()
          .in("id", framesToDelete);

        if (deleteError) {
          console.warn(
            "[Frames Webhook] Failed to delete placeholder frames:",
            deleteError,
          );
        }
      }
    }
  }

  // Step 6: Insert the generated frames
  const framesToInsert: FrameInsert[] = frameDescriptions.frames.map(
    (frame) => ({
      sequence_id: data.sequenceId,
      description: frame.description,
      order_index: frame.orderIndex,
      duration_ms: frame.durationMs,
      metadata: {
        ...frame.metadata,
        jobId,
        generatedAt: new Date().toISOString(),
        aiProvider: data.options?.aiProvider || "openai",
      } as Json,
    }),
  );

  // Try to insert frames, use upsert if there's a conflict
  let insertedFrames: Array<{
    id: string;
    description: string | null;
    [key: string]: unknown;
  }> | null = null;
  const { data: insertedFramesResult, error: insertError } = await supabase
    .from("frames")
    .insert(framesToInsert)
    .select();

  if (insertError) {
    // If we get a unique constraint violation, try upsert instead
    if (
      insertError.code === "23505" ||
      insertError.message.includes("duplicate key")
    ) {
      console.log("[Frames Webhook] Conflict detected, using upsert instead");

      const { data: upsertedFrames, error: upsertError } = await supabase
        .from("frames")
        .upsert(framesToInsert, {
          onConflict: "sequence_id,order_index",
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        throw new Error(`Failed to upsert frames: ${upsertError.message}`);
      }

      insertedFrames = upsertedFrames;
      console.log("[Frames Webhook] Frames upserted successfully", {
        count: upsertedFrames?.length,
        sequenceId: data.sequenceId,
      });
    } else {
      throw new Error(`Failed to insert frames: ${insertError.message}`);
    }
  } else {
    insertedFrames = insertedFramesResult;
    console.log("[Frames Webhook] Frames inserted successfully", {
      count: insertedFramesResult?.length,
      sequenceId: data.sequenceId,
    });
  }

  // Step 7: Queue image generation jobs for each frame (if enabled)
  if (
    data.options?.generateThumbnails !== false &&
    insertedFrames &&
    insertedFrames.length > 0
  ) {
    console.log("[Frames Webhook] Queueing image generation for frames", {
      frameCount: insertedFrames.length,
    });

    const qstashClient = getQStashClient();
    const imageGenerationPromises = [];

    for (const frame of insertedFrames) {
      // Skip frames without descriptions
      if (!frame.description) {
        continue;
      }

      // Create an image generation job for each frame
      const imageJob = await jobManager.createJob({
        type: "image",
        payload: {
          frameId: frame.id,
          sequenceId: data.sequenceId,
          prompt: frame.description,
          model: "flux_schnell", // Use fast model for thumbnails
          image_size: "landscape_16_9",
          num_images: 1,
        },
        userId: storedJob.user_id || undefined,
        teamId: storedJob.team_id || undefined,
      });

      // Queue the image generation job
      const imagePayload = {
        jobId: imageJob.id,
        type: "image" as const,
        userId: storedJob.user_id || undefined,
        teamId: storedJob.team_id || undefined,
        data: {
          frameId: frame.id,
          sequenceId: data.sequenceId,
          prompt: frame.description,
          model: "flux_schnell",
          image_size: "landscape_16_9" as const,
          num_images: 1,
          // Add style information if available
          style: styleStack as Json | undefined,
        },
      };

      imageGenerationPromises.push(
        qstashClient
          .publishImageJob(imagePayload, {
            delay: 0, // Process immediately
          })
          .then((response) => {
            console.log("[Frames Webhook] Image job queued for frame", {
              frameId: frame.id,
              imageJobId: imageJob.id,
              messageId: response.messageId,
            });
            return { frameId: frame.id, imageJobId: imageJob.id };
          }),
      );
    }

    // Wait for all image jobs to be queued
    try {
      await Promise.all(imageGenerationPromises);
      console.log("[Frames Webhook] All image generation jobs queued", {
        count: imageGenerationPromises.length,
      });
    } catch (error) {
      console.error("[Frames Webhook] Failed to queue some image jobs", error);
      // Don't fail the entire job if image queueing fails
    }
  }

  // Step 8: Update sequence metadata with frame generation info
  const { data: currentSequence } = await supabase
    .from("sequences")
    .select("metadata")
    .eq("id", data.sequenceId)
    .single();

  const updatedMetadata = {
    ...((currentSequence?.metadata as Record<string, unknown>) || {}),
    lastFrameGeneration: {
      jobId,
      generatedAt: new Date().toISOString(),
      frameCount: insertedFrames?.length || 0,
      totalDuration: frameDescriptions.totalDuration,
    },
  };

  const { error: updateError } = await supabase
    .from("sequences")
    .update({
      metadata: updatedMetadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.sequenceId);

  if (updateError) {
    console.warn(
      "[Frames Webhook] Failed to update sequence metadata:",
      updateError,
    );
  }

  // Return the result
  const result: FrameGenerationResult = {
    frames: frameDescriptions.frames,
    totalDuration: frameDescriptions.totalDuration,
    frameCount: frameDescriptions.frameCount,
  };

  console.log("[Frames Webhook] Job completed successfully", {
    jobId,
    frameCount: result.frameCount,
    totalDuration: result.totalDuration,
  });

  return result as unknown as Record<string, unknown>;
};

/**
 * Frame generation webhook handler
 */
const frameWebhookHandler = new BaseWebhookHandler();

/**
 * POST handler for frame generation webhooks
 */
export const POST = withQStashVerification(async (request) => {
  console.log("[FramesWebhook] Received frame generation webhook", {
    url: request.url,
    messageId: request.qstashMessageId,
    retryCount: request.qstashRetryCount,
  });

  return frameWebhookHandler.processWebhook(request, processFrameGeneration);
});

/**
 * GET handler for webhook testing
 */
export async function GET() {
  return Response.json({
    message: "Frame generation webhook endpoint",
    timestamp: new Date().toISOString(),
    status: "active",
  });
}
