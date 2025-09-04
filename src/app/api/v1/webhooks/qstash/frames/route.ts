/**
 * QStash webhook handler for frame generation jobs
 */

import { verifySignature } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { generateFrameDescriptions } from "@/lib/ai/frame-generator";
import { analyzeScriptForFrames } from "@/lib/ai/script-analyzer";
import { getJobManager } from "@/lib/qstash/job-manager";
import type {
  FrameGenerationPayload,
  FrameGenerationResult,
  QStashWebhookPayload,
} from "@/lib/qstash/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { FrameInsert, Json } from "@/types/database";

// Verify QStash signature
export const POST = verifySignature(handler, {
  nextSigningKeys: [process.env.QSTASH_CURRENT_SIGNING_KEY!],
});

async function handler(req: Request) {
  const jobManager = getJobManager();
  const supabase = createAdminClient();

  try {
    // Parse the webhook payload
    const body = await req.text();
    let payload: QStashWebhookPayload<FrameGenerationPayload>;

    try {
      payload = JSON.parse(body);
    } catch (e) {
      console.error("[Frames Webhook] Invalid JSON payload:", e);
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const jobPayload = payload.body;

    if (!jobPayload?.jobId || jobPayload.type !== "frame_generation") {
      console.error("[Frames Webhook] Invalid job payload:", jobPayload);
      return NextResponse.json(
        { error: "Invalid job payload" },
        { status: 400 },
      );
    }

    const { jobId, data } = jobPayload;

    console.log("[Frames Webhook] Processing job:", {
      jobId,
      sequenceId: data.sequenceId,
      hasScriptAnalysis: !!data.scriptAnalysis,
      options: data.options,
    });

    // Mark job as running
    await jobManager.startJob(jobId);

    try {
      // Step 1: Analyze script if no analysis provided
      let scriptAnalysis = data.scriptAnalysis;

      if (!scriptAnalysis) {
        console.log("[Frames Webhook] Analyzing script for scenes");
        scriptAnalysis = await analyzeScriptForFrames(
          data.script,
          data.options?.aiProvider,
        );
      }

      if (!scriptAnalysis?.scenes || scriptAnalysis.scenes.length === 0) {
        throw new Error("Failed to analyze script or no scenes found");
      }

      // Step 2: Generate frame descriptions for each scene
      console.log("[Frames Webhook] Generating frame descriptions", {
        sceneCount: scriptAnalysis.scenes.length,
        framesPerScene: data.options?.framesPerScene ?? 5,
      });

      const frameDescriptions = await generateFrameDescriptions({
        script: data.script,
        scriptAnalysis,
        styleStack: data.styleStack,
        framesPerScene: data.options?.framesPerScene ?? 5,
        aiProvider: data.options?.aiProvider,
      });

      if (!frameDescriptions?.frames || frameDescriptions.frames.length === 0) {
        throw new Error("Failed to generate frame descriptions");
      }

      // Step 3: Clear existing placeholder frames if any
      const { error: deleteError } = await supabase
        .from("frames")
        .delete()
        .eq("sequence_id", data.sequenceId)
        .eq("metadata->jobId", jobId);

      if (deleteError) {
        console.warn(
          "[Frames Webhook] Failed to delete placeholder frames:",
          deleteError,
        );
      }

      // Step 4: Insert the generated frames
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

      const { data: insertedFrames, error: insertError } = await supabase
        .from("frames")
        .insert(framesToInsert)
        .select();

      if (insertError) {
        throw new Error(`Failed to insert frames: ${insertError.message}`);
      }

      console.log("[Frames Webhook] Frames inserted successfully", {
        count: insertedFrames?.length,
        sequenceId: data.sequenceId,
      });

      // Step 5: Update sequence metadata with frame generation info
      const { error: updateError } = await supabase
        .from("sequences")
        .update({
          metadata: supabase.sql`
            COALESCE(metadata, '{}'::jsonb) || 
            ${JSON.stringify({
              lastFrameGeneration: {
                jobId,
                generatedAt: new Date().toISOString(),
                frameCount: insertedFrames?.length || 0,
                totalDuration: frameDescriptions.totalDuration,
              },
            })}::jsonb
          `,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.sequenceId);

      if (updateError) {
        console.warn(
          "[Frames Webhook] Failed to update sequence metadata:",
          updateError,
        );
      }

      // Mark job as completed
      const result: FrameGenerationResult = {
        frames: frameDescriptions.frames,
        totalDuration: frameDescriptions.totalDuration,
        frameCount: frameDescriptions.frameCount,
      };

      await jobManager.completeJob(jobId, result);

      console.log("[Frames Webhook] Job completed successfully", {
        jobId,
        frameCount: result.frameCount,
        totalDuration: result.totalDuration,
      });

      return NextResponse.json({
        success: true,
        jobId,
        frameCount: result.frameCount,
      });
    } catch (error) {
      console.error("[Frames Webhook] Processing error:", error);

      // Mark job as failed
      await jobManager.failJob(
        jobId,
        error instanceof Error
          ? error.message
          : "Unknown error during frame generation",
      );

      // Clean up any partial frames
      await supabase
        .from("frames")
        .delete()
        .eq("sequence_id", data.sequenceId)
        .eq("metadata->jobId", jobId);

      return NextResponse.json(
        {
          error: "Frame generation failed",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[Frames Webhook] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
