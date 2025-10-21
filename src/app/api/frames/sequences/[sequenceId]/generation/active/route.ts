/**
 * Active Frame Generation Job API Endpoint
 * GET /api/frames/sequences/[sequenceId]/generation/active - Get active frame generation job for a sequence
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
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

    // Verify sequence exists and get team_id
    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", sequenceId)
      .single();

    if (sequenceError || !sequence) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Verify team access
    await requireTeamMemberAccess(user.id, sequence.team_id);

    // Query for the most recent frame_generation job for this sequence
    // where status is pending or running
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("type", "frame_generation")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: null,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Check if this job is for the requested sequence
    const job = jobs[0];
    const payload = job.payload as Record<string, unknown> | null;
    const jobSequenceId = payload?.sequenceId as string | undefined;

    if (jobSequenceId !== sequenceId) {
      return NextResponse.json(
        {
          success: true,
          data: null,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Get frame progress
    const { data: frames } = await supabase
      .from("frames")
      .select("id, order_index, thumbnail_url")
      .eq("sequence_id", sequenceId)
      .order("order_index", { ascending: true });

    const options = payload?.options as Record<string, unknown> | undefined;
    const framesPerScene = (options?.framesPerScene as number) || 3;

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
          framesProgress: {
            total: framesPerScene,
            completed: frames?.filter((f) => f.thumbnail_url).length || 0,
            frames: frames || [],
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[GET /api/frames/sequences/[sequenceId]/generation/active] Error:",
      error,
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get active generation job",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
