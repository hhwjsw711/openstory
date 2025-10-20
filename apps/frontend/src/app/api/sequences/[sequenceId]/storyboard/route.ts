/**
 * Generate Storyboard API Endpoint (Legacy)
 * POST /api/sequences/[sequenceId]/storyboard - Generate storyboard (legacy, calls generateFrames)
 *
 * Note: This is a legacy endpoint that wraps the frames/generate endpoint.
 * It validates the sequence exists and has the required data, then delegates to frame generation.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager, JobType } from "@/lib/qstash/job-manager";
import { sequenceService } from "@/lib/services/sequence.service";
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

    // Verify sequence exists and has required data
    const sequence = await sequenceService.getSequence(sequenceId, false);

    if (!sequence.script || !sequence.style_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence missing script or style",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Verify user has access to the sequence's team
    const { data: seq } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", sequenceId)
      .single();

    if (seq) {
      await requireTeamMemberAccess(user.id, seq.team_id);
    }

    // Check for existing active jobs to prevent duplicates
    const jobManager = getJobManager();
    const existingJobs = await jobManager.getJobsByStatus("running", {
      teamId: seq?.team_id,
    });

    const existingFrameJob = existingJobs.find((job) => {
      if (job.type !== "frame_generation") return false;
      const payload = job.payload as { sequenceId?: string };
      return payload?.sequenceId === sequenceId;
    });

    if (existingFrameJob) {
      console.log(
        "[generateStoryboard] Found existing active job, returning it",
        {
          sequenceId,
          existingJobId: existingFrameJob.id,
        },
      );
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: existingFrameJob.id,
            frames: [],
          },
          message: "Storyboard generation job already running",
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Also check for pending jobs
    const pendingJobs = await jobManager.getJobsByStatus("pending", {
      teamId: seq?.team_id,
    });

    const existingPendingJob = pendingJobs.find((job) => {
      if (job.type !== "frame_generation") return false;
      const payload = job.payload as { sequenceId?: string };
      return payload?.sequenceId === sequenceId;
    });

    if (existingPendingJob) {
      console.log(
        "[generateStoryboard] Found existing pending job, returning it",
        {
          sequenceId,
          existingJobId: existingPendingJob.id,
        },
      );
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: existingPendingJob.id,
            frames: [],
          },
          message: "Storyboard generation job already queued",
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
      teamId: seq?.team_id,
    });

    // Queue the frame generation job via QStash
    const qstashClient = getQStashClient();
    await qstashClient.publishFrameGenerationJob({
      jobId: job.id,
      type: JobType.FRAME_GENERATION,
      userId: user.id,
      teamId: seq?.team_id || "",
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

    console.log("[generateStoryboard] Storyboard generation job queued", {
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
        message: "Storyboard generation started successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[POST /api/sequences/[sequenceId]/storyboard] Error:",
      error,
    );
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate storyboard",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
