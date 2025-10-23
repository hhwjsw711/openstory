/**
 * API endpoint for generating motion (video) from a frame's thumbnail
 * POST /api/sequences/[sequenceId]/frames/[frameId]/motion
 */

import { z } from "zod";
import {
  requireTeamMemberAccess,
  requireUser,
  validateMotionAccess,
} from "@/lib/auth/action-utils";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/auth/api-utils";
import { ValidationError } from "@/lib/errors";
import { generateMotionSchema } from "@/lib/schemas/frame.schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { MotionWorkflowInput } from "@/lib/workflow";
import { getQStashClient, workflowConfig } from "@/lib/workflow";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string; frameId: string }> }
) {
  try {
    const { sequenceId, frameId } = await params;

    // Validate UUIDs
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
      uuidSchema.parse(frameId);
    } catch {
      throw new ValidationError("Invalid sequence or frame ID format");
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = generateMotionSchema.parse(body);

    // Authenticate user (motion requires authenticated users)
    const user = await requireUser();
    validateMotionAccess(user);

    const supabase = createServerClient();

    // Get frame with sequence info
    const { data: frame, error: frameError } = await supabase
      .from("frames")
      .select("*, sequences!inner(id, team_id, script, style_id, styles(*))")
      .eq("id", frameId)
      .eq("sequence_id", sequenceId)
      .single();

    if (frameError || !frame) {
      throw new ValidationError("Frame not found in this sequence");
    }

    // Verify user has access to this frame
    await requireTeamMemberAccess(user.id, frame.sequences.team_id);

    if (!frame.thumbnail_url) {
      return createErrorResponse(
        "Frame has no thumbnail to generate motion from",
        400
      );
    }

    // Trigger motion generation workflow
    const workflowInput: MotionWorkflowInput = {
      userId: user.id,
      teamId: frame.sequences.team_id,
      frameId,
      sequenceId: frame.sequence_id,
      thumbnailUrl: frame.thumbnail_url,
      prompt: frame.description || undefined,
      model: validated.model,
      duration: validated.duration,
      fps: validated.fps,
      motionBucket: validated.motionBucket,
    };

    // Publish to QStash to trigger the workflow
    const qstash = getQStashClient();
    const { messageId } = await qstash.publishJSON({
      url: `${workflowConfig.baseUrl}/motion`,
      body: workflowInput,
    });

    const workflowRunId = messageId;

    return createSuccessResponse(
      {
        workflowRunId,
        frameId,
        sequenceId: frame.sequence_id,
      },
      "Motion generation started successfully"
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.message, 400);
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
