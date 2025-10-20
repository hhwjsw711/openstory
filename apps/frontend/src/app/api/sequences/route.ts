/**
 * Sequences API Endpoint
 * POST /api/sequences - Create a new sequence
 * GET /api/sequences - List all sequences for the user's team
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/action-utils";
import { handleApiError } from "@/lib/errors";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager, JobType } from "@/lib/qstash/job-manager";
import { createSequenceSchema } from "@/lib/schemas/sequence.schemas";
import { sequenceService } from "@/lib/services/sequence.service";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    const validated = createSequenceSchema.parse(body);

    const supabase = createServerClient();

    // Get user's team
    const { data: teamMemberships, error: teamError } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .order("role", { ascending: true })
      .limit(1);

    if (teamError || !teamMemberships || teamMemberships.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No team found for user. Please refresh the page to initialize your account.",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const teamId = teamMemberships[0].team_id;

    // Create sequence
    const sequence = await sequenceService.createSequence({
      teamId,
      userId: user.id,
      name: validated.name,
      script: validated.script,
      styleId: validated.style_id || undefined,
    });

    // Generate frames asynchronously
    const jobManager = getJobManager();
    const qstashClient = getQStashClient();

    // Check for existing active jobs to prevent duplicates
    const existingJobs = await jobManager.getJobsByStatus("running", {
      teamId,
    });

    const existingFrameJob = existingJobs.find((job) => {
      if (job.type !== "frame_generation") return false;
      const payload = job.payload as { sequenceId?: string };
      return payload?.sequenceId === sequence.id;
    });

    if (!existingFrameJob) {
      // Also check for pending jobs
      const pendingJobs = await jobManager.getJobsByStatus("pending", {
        teamId,
      });

      const existingPendingJob = pendingJobs.find((job) => {
        if (job.type !== "frame_generation") return false;
        const payload = job.payload as { sequenceId?: string };
        return payload?.sequenceId === sequence.id;
      });

      if (!existingPendingJob) {
        // Create a job for frame generation
        const job = await jobManager.createJob({
          type: JobType.FRAME_GENERATION,
          payload: {
            sequenceId: sequence.id,
            options: {
              framesPerScene: 3,
              generateThumbnails: true,
              generateDescriptions: true,
              aiProvider: "openrouter",
              regenerateAll: true,
            },
          },
          userId: user.id,
          teamId,
        });

        // Queue the frame generation job via QStash
        await qstashClient.publishFrameGenerationJob({
          jobId: job.id,
          type: JobType.FRAME_GENERATION,
          userId: user.id,
          teamId,
          data: {
            sequenceId: sequence.id,
            options: {
              framesPerScene: 3,
              generateThumbnails: true,
              generateDescriptions: true,
              aiProvider: "openrouter",
              regenerateAll: true,
            },
          },
        });
      }
    }

    // Revalidate paths
    revalidatePath(`/sequences/${sequence.id}`);
    revalidatePath(`/sequences/${sequence.id}/script`);
    revalidatePath(`/sequences/${sequence.id}/storyboard`);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        message: "Sequence created successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/sequences] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create sequence",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}

export async function GET() {
  try {
    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Get user's team
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      // No team membership yet, return empty array
      return NextResponse.json(
        {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const sequences = await sequenceService.getSequencesByTeam(
      membership.team_id,
    );

    return NextResponse.json(
      {
        success: true,
        data: sequences,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/sequences] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to list sequences",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
