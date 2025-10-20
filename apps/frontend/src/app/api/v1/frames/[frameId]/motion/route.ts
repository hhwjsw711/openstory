/**
 * API endpoint for generating motion (video) from a frame's thumbnail
 * POST /api/v1/frames/[frameId]/motion
 */

import { z } from "zod";
import {
  requireTeamMemberAccess,
  requireUser,
  validateMotionAccess,
} from "@/lib/auth/action-utils";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/lib/auth/api-utils";
import { ValidationError } from "@/lib/errors";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager } from "@/lib/qstash/job-manager";
import { generateMotionSchema } from "@/lib/schemas/frame.schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ frameId: string }> },
) {
  try {
    const { frameId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(frameId);
    } catch {
      throw new ValidationError("Invalid frame ID format");
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = generateMotionSchema.parse(body);

    // Authenticate user (motion requires authenticated users)
    const user = await requireUser();
    validateMotionAccess(user);

    const supabase = createServerClient();

    // Get frame with sequence info
    const { data: frame, error: frameError } = await supabase
      .from("frames")
      .select("*, sequences!inner(id, team_id, script, style_id, styles(*))")
      .eq("id", frameId)
      .single();

    if (frameError || !frame) {
      throw new ValidationError("Frame not found");
    }

    // Validate frame has thumbnail
    if (!frame.thumbnail_url) {
      throw new ValidationError(
        "Frame must have a thumbnail before generating motion",
      );
    }

    // Verify user has access to the frame's team
    await requireTeamMemberAccess(user.id, frame.sequences.team_id);

    // Create a job for motion generation
    const jobManager = getJobManager();
    const job = await jobManager.createJob({
      type: "motion",
      payload: {
        frameId,
        sequenceId: frame.sequence_id,
        thumbnailUrl: frame.thumbnail_url,
        prompt: frame.description,
        model: validated.model,
        duration: validated.duration,
        fps: validated.fps,
        motionBucket: validated.motionBucket,
      },
      userId: user.id,
      teamId: frame.sequences.team_id,
    });

    // Queue the motion generation job
    const qstashClient = getQStashClient();
    const motionPayload = {
      jobId: job.id,
      type: "motion" as const,
      userId: user.id,
      teamId: frame.sequences.team_id,
      data: {
        frameId,
        sequenceId: frame.sequence_id,
        thumbnailUrl: frame.thumbnail_url,
        prompt: frame.description || undefined,
        model: validated.model || "svd-lcm",
        duration: validated.duration || 2,
        fps: validated.fps || 7,
        motionBucket: validated.motionBucket || 127,
      },
    };

    const response = await qstashClient.publishMotionJob(motionPayload, {
      delay: 0,
    });

    console.log("[POST /api/v1/frames/[frameId]/motion] Motion job queued", {
      frameId,
      jobId: job.id,
      messageId: response.messageId,
    });

    // Update frame metadata with motion generation status
    await supabase
      .from("frames")
      .update({
        metadata: {
          ...(frame.metadata as Record<string, unknown>),
          motionJobId: job.id,
          motionStatus: "generating",
          motionModel: validated.model || "svd-lcm",
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", frameId);

    return createSuccessResponse(
      {
        jobId: job.id,
      },
      "Motion generation started successfully",
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.message, 400);
    }
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid request data", 400);
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

// GET endpoint to check motion generation status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ frameId: string }> },
) {
  try {
    const supabase = createServerClient();
    const { frameId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(frameId);
    } catch {
      throw new ValidationError("Invalid frame ID format");
    }

    // Check authentication
    await requireAuth(request);

    // Get frame with motion status
    const { data: frame, error } = await supabase
      .from("frames")
      .select("id, video_url, duration_ms, metadata")
      .eq("id", frameId)
      .single();

    if (error || !frame) {
      return createErrorResponse("Frame not found", 404);
    }

    const metadata = frame.metadata as Record<string, unknown> | null;
    const motionStatus = metadata?.motionStatus as string | undefined;
    const motionJobId = metadata?.motionJobId as string | undefined;
    const motionModel = metadata?.motionModel as string | undefined;

    return createSuccessResponse({
      frameId: frame.id,
      hasVideo: !!frame.video_url,
      videoUrl: frame.video_url,
      durationMs: frame.duration_ms,
      motionStatus: motionStatus || (frame.video_url ? "completed" : "none"),
      motionJobId,
      motionModel,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.message, 400);
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
