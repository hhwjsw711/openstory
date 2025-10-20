/**
 * Bulk Frames API Endpoint
 * POST /api/v1/frames/bulk - Create multiple frames at once
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError } from "@/lib/errors";
import { frameService } from "@/lib/services/frame.service";
import { createServerClient } from "@/lib/supabase/server";
import type { FrameInsert, Json } from "@/types/database";

const frameSchema = z.object({
  description: z.string().min(1).max(5000),
  order_index: z.number().int(),
  thumbnail_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  duration_ms: z.number().int().min(1).optional(),
  metadata: z.any().optional() as z.ZodType<Json | undefined>,
});

const bulkCreateSchema = z.object({
  sequenceId: z.string().uuid(),
  frames: z.array(frameSchema).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = bulkCreateSchema.parse(body);

    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Verify sequence exists and get team_id
    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", validated.sequenceId)
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

    // Prepare frame inserts
    const frameInserts: FrameInsert[] = validated.frames.map((frame) => ({
      sequence_id: validated.sequenceId,
      description: frame.description,
      order_index: frame.order_index,
      thumbnail_url: frame.thumbnail_url,
      video_url: frame.video_url,
      duration_ms: frame.duration_ms,
      metadata: frame.metadata,
    }));

    // Bulk insert frames
    const frames = await frameService.bulkInsertFrames(frameInserts);

    return NextResponse.json(
      {
        success: true,
        data: frames,
        message: `${frames.length} frames created successfully`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/v1/frames/bulk] Error:", error);

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
        message: "Failed to create frames",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
