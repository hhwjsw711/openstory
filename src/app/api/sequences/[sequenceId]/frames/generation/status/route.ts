/**
 * Frame Generation Status API Endpoint
 * GET /api/sequences/[sequenceId]/frames/generation/status - Get frame generation status for a sequence
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

    // Verify sequence exists and get team_id + status
    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("team_id, status, metadata")
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

    // If sequence is not processing, return null (no active generation)
    if (sequence.status !== "processing") {
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

    // Get expected frame count from metadata
    const metadata = sequence.metadata as Record<string, unknown> | null;
    const frameGenMetadata = metadata?.frameGeneration as
      | Record<string, unknown>
      | undefined;
    const expectedFrameCount =
      (frameGenMetadata?.expectedFrameCount as number) || 3;

    return NextResponse.json(
      {
        success: true,
        data: {
          status: sequence.status,
          framesProgress: {
            total: expectedFrameCount,
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
      "[GET /api/sequences/[sequenceId]/frames/generation/status] Error:",
      error,
    );

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get generation status",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
