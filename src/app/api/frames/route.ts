/**
 * Frames API Endpoint
 * POST /api/frames - Create a new frame
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError } from "@/lib/errors";
import { createFrameSchema } from "@/lib/schemas/frame.schemas";
import { frameService } from "@/lib/services/frame.service";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = createFrameSchema.parse(body);

    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Verify sequence exists and get team_id
    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", validated.sequence_id)
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

    // Create frame
    const frame = await frameService.createFrame({
      sequenceId: validated.sequence_id,
      description: validated.description,
      orderIndex: validated.order_index,
      thumbnailUrl: validated.thumbnail_url,
      videoUrl: validated.video_url,
      durationMs: validated.duration_ms,
      metadata: validated.metadata,
    });

    return NextResponse.json(
      {
        success: true,
        data: frame,
        message: "Frame created successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/frames] Error:", error);

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
        message: "Failed to create frame",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
