/**
 * Sequence Frames API Endpoint
 * GET /api/sequences/[sequenceId]/frames - Get all frames for a sequence
 * DELETE /api/sequences/[sequenceId]/frames - Delete all frames for a sequence
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { frameService } from "@/lib/services/frame.service";
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

    // Get frames
    const frames = await frameService.getFramesBySequence(sequenceId);

    return NextResponse.json(
      {
        success: true,
        data: frames,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/sequences/[sequenceId]/frames] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get frames",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}

export async function DELETE(
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

    // Delete frames
    await frameService.deleteFramesBySequence(sequenceId);

    return NextResponse.json(
      {
        success: true,
        message: "Frames deleted successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DELETE /api/sequences/[sequenceId]/frames] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete frames",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
