/**
 * QStash webhook handler for frame generation jobs
 */

import { NextResponse } from "next/server";
import { generateFrameDescriptions } from "@/lib/ai/frame-generator";
import { analyzeScriptForFrames } from "@/lib/ai/script-analyzer";
import { getJobManager } from "@/lib/qstash/job-manager";
import {
  type QStashVerifiedRequest,
  withQStashVerification,
} from "@/lib/qstash/middleware";
import type {
  FrameGenerationPayload,
  FrameGenerationResult,
} from "@/lib/qstash/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { FrameInsert, Json } from "@/types/database";

async function handler(req: QStashVerifiedRequest) {
  const jobManager = getJobManager();
  const supabase = createAdminClient();

  try {
    // Parse the webhook payload
    const body = await req.text();
    let jobPayload: FrameGenerationPayload;

    try {
      jobPayload = JSON.parse(body);
    } catch (e) {
      console.error("[Frames Webhook] Invalid JSON payload:", e);
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

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
      options: data.options,
    });

    // Step 1: Validate job authorization
    console.log("[Frames Webhook] Validating job authorization");
    const storedJob = await jobManager.getJob(jobId);

    if (!storedJob) {
      console.error("[Frames Webhook] Job not found:", jobId);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Mark job as running
    await jobManager.startJob(jobId);

    try {
      // Step 2: Load sequence data from database
      console.log("[Frames Webhook] Loading sequence data from database");
      const { data: sequence, error: sequenceError } = await supabase
        .from("sequences")
        .select("*, styles(*)")
        .eq("id", data.sequenceId)
        .single();

      if (sequenceError || !sequence) {
        throw new Error(`Sequence not found: ${data.sequenceId}`);
      }

      // Step 3: Verify team authorization
      // Check that the job's team_id matches the sequence's team_id
      if (storedJob.team_id && sequence.team_id !== storedJob.team_id) {
        console.error(
          "[Frames Webhook] Team ID mismatch - unauthorized access",
          {
            jobTeamId: storedJob.team_id,
            sequenceTeamId: sequence.team_id,
            jobId,
            sequenceId: data.sequenceId,
          },
        );
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
          console.error(
            "[Frames Webhook] User not a team member - unauthorized",
            {
              userId: storedJob.user_id,
              teamId: storedJob.team_id,
              jobId,
            },
          );
          throw new Error("Unauthorized: User not a team member");
        }
      }

      if (!sequence.script) {
        throw new Error("Sequence has no script");
      }

      if (!sequence.style_id) {
        throw new Error("Sequence has no style selected");
      }

      // Step 4: Analyze script to determine frame boundaries
      console.log("[Frames Webhook] Analyzing script for scenes");
      const scriptAnalysis = await analyzeScriptForFrames(
        sequence.script,
        data.options?.aiProvider,
      );

      if (!scriptAnalysis?.scenes || scriptAnalysis.scenes.length === 0) {
        throw new Error("Failed to analyze script or no scenes found");
      }

      // Step 5: Generate frame descriptions for each scene
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

      // Step 6: Handle existing frames
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

      // Step 7: Insert the generated frames
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
      const { data: insertedFrames, error: insertError } = await supabase
        .from("frames")
        .insert(framesToInsert)
        .select();

      if (insertError) {
        // If we get a unique constraint violation, try upsert instead
        if (
          insertError.code === "23505" ||
          insertError.message.includes("duplicate key")
        ) {
          console.log(
            "[Frames Webhook] Conflict detected, using upsert instead",
          );

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

          console.log("[Frames Webhook] Frames upserted successfully", {
            count: upsertedFrames?.length,
            sequenceId: data.sequenceId,
          });
        } else {
          throw new Error(`Failed to insert frames: ${insertError.message}`);
        }
      } else {
        console.log("[Frames Webhook] Frames inserted successfully", {
          count: insertedFrames?.length,
          sequenceId: data.sequenceId,
        });
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

      // Mark job as completed
      const result: FrameGenerationResult = {
        frames: frameDescriptions.frames,
        totalDuration: frameDescriptions.totalDuration,
        frameCount: frameDescriptions.frameCount,
      };

      await jobManager.completeJob(
        jobId,
        result as unknown as Record<string, unknown>,
      );

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
      // First get frames with matching jobId in metadata
      const { data: partialFrames } = await supabase
        .from("frames")
        .select("id, metadata")
        .eq("sequence_id", data.sequenceId);

      // Filter frames with matching jobId and delete them
      if (partialFrames && partialFrames.length > 0) {
        const framesToDelete = partialFrames
          .filter((frame) => {
            const metadata = frame.metadata as Record<string, unknown> | null;
            return metadata?.jobId === jobId;
          })
          .map((frame) => frame.id);

        if (framesToDelete.length > 0) {
          await supabase.from("frames").delete().in("id", framesToDelete);
        }
      }

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

// Export verified POST handler
export const POST = withQStashVerification(handler);
