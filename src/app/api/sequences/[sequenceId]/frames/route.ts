/**
 * Sequence Frames API Endpoint
 * GET /api/sequences/[sequenceId]/frames - Get all frames for a sequence
 * POST /api/sequences/[sequenceId]/frames - Create frame(s) for a sequence
 * DELETE /api/sequences/[sequenceId]/frames - Delete all frames for a sequence
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { frameService } from "@/lib/services/frame.service";
import { createServerClient } from "@/lib/supabase/server";
import type { FrameInsert, Json } from "@/types/database";

// Schema for single frame creation
const singleFrameSchema = z.object({
  description: z.string().min(1).max(5000),
  order_index: z.number().int(),
  thumbnail_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  duration_ms: z.number().int().min(1).optional(),
  metadata: z.any().optional() as z.ZodType<Json | undefined>,
});

// Schema for bulk frame creation
const bulkFrameSchema = z.object({
  frames: z.array(singleFrameSchema).min(1).max(100),
});

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

export async function POST(
  request: Request,
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

    // Parse request body
    const body = await request.json();

    // Determine if this is bulk or single creation
    const isBulk = "frames" in body && Array.isArray(body.frames);

    if (isBulk) {
      // Bulk creation
      const validated = bulkFrameSchema.parse(body);

      const frameInserts: FrameInsert[] = validated.frames.map((frame) => ({
        sequence_id: sequenceId,
        description: frame.description,
        order_index: frame.order_index,
        thumbnail_url: frame.thumbnail_url,
        video_url: frame.video_url,
        duration_ms: frame.duration_ms,
        metadata: frame.metadata,
      }));

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
    }

    // Single creation
    const validated = singleFrameSchema.parse(body);

    const frame = await frameService.createFrame({
      sequenceId,
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
    console.error("[POST /api/sequences/[sequenceId]/frames] Error:", error);

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
        message: "Failed to create frame(s)",
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
