/**
 * Generate Frames API Endpoint
 * POST /api/sequences/[sequenceId]/frames/generate - Generate frames for a sequence
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager, JobType } from "@/lib/qstash/job-manager";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> },
) {
  try {
    const { sequenceId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError("Invalid sequence ID format");
    }

    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Verify sequence exists and get team info
    const { data: sequence } = await supabase
      .from("sequences")
      .select("id, team_id")
      .eq("id", sequenceId)
      .single();

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Verify user has access to this sequence
    await requireTeamMemberAccess(user.id, sequence.team_id);

    // Check for existing active jobs to prevent duplicates
    const jobManager = getJobManager();
    const existingJobs = await jobManager.getJobsByStatus("running", {
      teamId: sequence.team_id,
    });

    const existingFrameJob = existingJobs.find((job) => {
      if (job.type !== "frame_generation") return false;
      const payload = job.payload as { sequenceId?: string };
      return payload?.sequenceId === sequenceId;
    });

    if (existingFrameJob) {
      console.log("[generateFrames] Found existing active job, returning it", {
        sequenceId,
        existingJobId: existingFrameJob.id,
      });
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: existingFrameJob.id,
            frames: [],
          },
          message: "Frame generation job already running",
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Also check for pending jobs
    const pendingJobs = await jobManager.getJobsByStatus("pending", {
      teamId: sequence.team_id,
    });

    const existingPendingJob = pendingJobs.find((job) => {
      if (job.type !== "frame_generation") return false;
      const payload = job.payload as { sequenceId?: string };
      return payload?.sequenceId === sequenceId;
    });

    if (existingPendingJob) {
      console.log("[generateFrames] Found existing pending job, returning it", {
        sequenceId,
        existingJobId: existingPendingJob.id,
      });
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: existingPendingJob.id,
            frames: [],
          },
          message: "Frame generation job already queued",
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Create a job for frame generation
    const job = await jobManager.createJob({
      type: JobType.FRAME_GENERATION,
      payload: {
        sequenceId,
        options: {
          framesPerScene: 3,
          generateThumbnails: true,
          generateDescriptions: true,
          aiProvider: "openrouter",
          regenerateAll: true,
        },
      },
      userId: user.id,
      teamId: sequence.team_id,
    });

    // Queue the frame generation job via QStash
    const qstashClient = getQStashClient();
    await qstashClient.publishFrameGenerationJob({
      jobId: job.id,
      type: JobType.FRAME_GENERATION,
      userId: user.id,
      teamId: sequence.team_id,
      data: {
        sequenceId,
        options: {
          framesPerScene: 3,
          generateThumbnails: true,
          generateDescriptions: true,
          aiProvider: "openrouter",
          regenerateAll: true,
        },
      },
    });

    console.log("[generateFrames] Frame generation job queued", {
      sequenceId,
      jobId: job.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: job.id,
          frames: [],
        },
        message: "Frame generation started successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[POST /api/sequences/[sequenceId]/frames/generate] Error:",
      error,
    );
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate frames",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
