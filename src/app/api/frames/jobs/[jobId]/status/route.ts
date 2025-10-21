/**
 * Frame Generation Job Status API Endpoint
 * GET /api/frames/jobs/[jobId]/status - Get status of a frame generation job
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getJobManager } from "@/lib/qstash/job-manager";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    // Validate job ID (UUID)
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(jobId);
    } catch {
      throw new ValidationError("Invalid job ID format");
    }

    // Authenticate user
    const user = await requireUser();
    const jobManager = getJobManager();
    const job = await jobManager.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "Job not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Check if user has access to this job
    const supabase = createServerClient();
    if (job.user_id && job.user_id !== user.id) {
      // Check if user is part of the same team
      if (job.team_id) {
        const { data: member } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", job.team_id)
          .eq("user_id", user.id)
          .single();

        if (!member) {
          return NextResponse.json(
            {
              success: false,
              message: "Unauthorized",
              timestamp: new Date().toISOString(),
            },
            { status: 401 },
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized",
            timestamp: new Date().toISOString(),
          },
          { status: 401 },
        );
      }
    }

    // If job is for frame generation, also check how many frames have been created
    let framesProgress:
      | {
          total: number;
          completed: number;
          frames: Array<{
            id: string;
            order_index: number;
            thumbnail_url: string | null;
          }>;
        }
      | undefined;

    if (job.type === "frame_generation" && job.payload) {
      const payload = job.payload as Record<string, unknown>;
      const sequenceId = payload.sequenceId as string | undefined;

      if (sequenceId) {
        const { data: frames } = await supabase
          .from("frames")
          .select("id, order_index, thumbnail_url")
          .eq("sequence_id", sequenceId)
          .order("order_index", { ascending: true });

        const options = payload.options as Record<string, unknown> | undefined;
        const framesPerScene = (options?.framesPerScene as number) || 3;

        framesProgress = {
          total: framesPerScene,
          completed: frames?.filter((f) => f.thumbnail_url).length || 0,
          frames: frames || [],
        };
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: job.id,
          type: job.type,
          status: job.status,
          result: job.result,
          error: job.error || undefined,
          created_at: job.created_at,
          updated_at: job.updated_at,
          framesProgress,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/frames/jobs/[jobId]/status] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get job status",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
