/**
 * Generate Frames API Endpoint
 * POST /api/sequences/[sequenceId]/frames/generate - Generate frames for a sequence
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import type { FrameGenerationWorkflowInput } from "@/lib/workflow";
import { getQStashClient, workflowConfig } from "@/lib/workflow";

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

    // Verify sequence exists and get team info
    const { data: sequence } = await supabase
      .from("sequences")
      .select("id, team_id, status")
      .eq("id", sequenceId)
      .single();

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Verify user has access to this sequence
    await requireTeamMemberAccess(user.id, sequence.team_id);

    // Check if sequence is already processing
    if (sequence.status === "processing") {
      console.log("[generateFrames] Sequence already processing", {
        sequenceId,
      });
      return NextResponse.json(
        {
          success: true,
          message: "Frame generation already in progress",
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // Update sequence status to processing
    await supabase
      .from("sequences")
      .update({ status: "processing" })
      .eq("id", sequenceId);

    // Trigger frame generation workflow
    const workflowInput: FrameGenerationWorkflowInput = {
      userId: user.id,
      teamId: sequence.team_id,
      sequenceId,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: "openrouter",
        regenerateAll: true,
      },
    };

    // Publish to QStash to trigger the workflow
    const qstash = getQStashClient();
    const { messageId } = await qstash.publishJSON({
      url: `${workflowConfig.baseUrl}/frame-generation`,
      body: workflowInput,
    });

    const workflowRunId = messageId;

    console.log("[generateFrames] Frame generation workflow triggered", {
      sequenceId,
      workflowRunId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          frames: [],
        },
        message: "Frame generation started successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[POST /api/sequences/[sequenceId]/frames/generate] Error:",
      error,
    );
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate frames",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
