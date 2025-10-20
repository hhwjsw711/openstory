/**
 * Regenerate Frame API Endpoint
 * POST /api/v1/frames/[frameId]/regenerate - Regenerate a single frame
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getJobManager } from "@/lib/qstash/job-manager";
import { regenerateFrameSchema } from "@/lib/schemas/frame.schemas";
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
    const validated = regenerateFrameSchema.parse(body);

    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Get frame with sequence info
    const { data: frame, error: frameError } = await supabase
      .from("frames")
      .select("*, sequences!inner(id, team_id, script)")
      .eq("id", frameId)
      .single();

    if (frameError || !frame) {
      return NextResponse.json(
        {
          success: false,
          message: "Frame not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Verify team access
    await requireTeamMemberAccess(user.id, frame.sequences.team_id);

    // Create a job for regeneration
    const jobManager = getJobManager();
    const job = await jobManager.createJob({
      type: "frame_generation",
      payload: {
        frameId,
        sequenceId: frame.sequence_id,
        regenerateDescription: validated.regenerateDescription ?? true,
        regenerateThumbnail: validated.regenerateThumbnail ?? false,
      },
      userId: user.id,
      teamId: frame.sequences.team_id,
    });

    // Update frame metadata with regeneration status
    await supabase
      .from("frames")
      .update({
        metadata: {
          ...(frame.metadata as Record<string, unknown>),
          regenerationJobId: job.id,
          status: "regenerating",
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", frameId);

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: job.id,
        },
        message: "Frame regeneration started successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/v1/frames/[frameId]/regenerate] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to regenerate frame",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
