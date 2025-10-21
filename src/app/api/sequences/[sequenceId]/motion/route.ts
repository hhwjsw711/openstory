/**
 * API endpoint for generating motion for all frames in a sequence
 * POST /api/sequences/[sequenceId]/motion
 */

import { z } from "zod";
import { IMAGE_TO_VIDEO_MODELS } from "@/lib/ai/models";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuthenticatedUserForMotion,
} from "@/lib/auth/api-utils";
import { ValidationError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import type { MotionWorkflowInput } from "@/lib/workflow";
import { getQStashClient, workflowConfig } from "@/lib/workflow";

// Request body schema
const requestSchema = z.object({
  model: z
    .enum(
      Object.keys(IMAGE_TO_VIDEO_MODELS) as [
        keyof typeof IMAGE_TO_VIDEO_MODELS,
      ],
    )
    .optional(),
  duration: z.number().min(1).max(10).optional(),
  fps: z.number().min(7).max(30).optional(),
  motionBucket: z.number().min(1).max(255).optional(),
  frameIds: z.array(z.string().uuid()).optional(), // Optional: specific frames to generate
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string }> },
) {
  try {
    const supabase = createServerClient();
    const { sequenceId } = await params;

    // Validate UUID
    const uuidSchema = z.string().uuid();
    try {
      uuidSchema.parse(sequenceId);
    } catch {
      throw new ValidationError("Invalid sequence ID format");
    }

    // Check authentication and get user
    const authResult = await requireAuthenticatedUserForMotion(request);
    const user = authResult.user;

    // Get user's team
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return createErrorResponse("No team found for user", 404);
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Get frames for the sequence
    let frameQuery = supabase
      .from("frames")
      .select("id, thumbnail_url, description, order_index")
      .eq("sequence_id", sequenceId)
      .order("order_index", { ascending: true });

    // Filter by specific frame IDs if provided
    if (validatedData.frameIds && validatedData.frameIds.length > 0) {
      frameQuery = frameQuery.in("id", validatedData.frameIds);
    }

    const { data: frames, error: framesError } = await frameQuery;

    if (framesError || !frames || frames.length === 0) {
      return createErrorResponse("No frames found for sequence", 404);
    }

    // Filter frames that have thumbnails
    const framesWithThumbnails = frames.filter((f) => f.thumbnail_url);

    if (framesWithThumbnails.length === 0) {
      return createErrorResponse("No frames with thumbnails found", 400);
    }

    // Generate motion for each frame using workflows
    const workflows = [];
    const errors = [];

    for (const frame of framesWithThumbnails) {
      try {
        // TypeScript guard - we already filtered for frames with thumbnails
        if (!frame.thumbnail_url) continue;

        // Use description or empty string as fallback
        const prompt = frame.description || "";

        // Trigger motion workflow
        const workflowInput: MotionWorkflowInput = {
          userId: user.id,
          teamId: membership.team_id,
          frameId: frame.id,
          sequenceId,
          thumbnailUrl: frame.thumbnail_url,
          prompt,
          model: validatedData.model,
          duration: validatedData.duration,
          fps: validatedData.fps,
          motionBucket: validatedData.motionBucket,
        };

        // Publish to QStash to trigger the workflow
        const qstash = getQStashClient();
        const { messageId } = await qstash.publishJSON({
          url: `${workflowConfig.baseUrl}/motion`,
          body: workflowInput,
        });

        workflows.push({
          frameId: frame.id,
          workflowRunId: messageId,
          orderIndex: frame.order_index,
        });
      } catch (error) {
        errors.push({
          frameId: frame.id,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start motion generation",
        });
      }
    }

    return createSuccessResponse(
      {
        sequenceId,
        totalFrames: frames.length,
        framesWithThumbnails: framesWithThumbnails.length,
        workflowsStarted: workflows.length,
        workflows,
        errors: errors.length > 0 ? errors : undefined,
      },
      `Motion generation started for ${workflows.length} frames`,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(error.message, 400);
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
