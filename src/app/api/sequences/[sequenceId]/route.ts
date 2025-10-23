/**
 * Sequence API Endpoint
 * GET /api/sequences/[sequenceId] - Get a sequence by ID
 * PATCH /api/sequences/[sequenceId] - Update a sequence
 * DELETE /api/sequences/[sequenceId] - Delete a sequence
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMemberAccess, requireUser } from "@/lib/auth/action-utils";
import { handleApiError, ValidationError } from "@/lib/errors";
import { sequenceService } from "@/lib/services/sequence.service";
import { createServerClient } from "@/lib/supabase/server";
import type { FrameGenerationWorkflowInput } from "@/lib/workflow";
import { getQStashClient, workflowConfig } from "@/lib/workflow";

const updateSequenceRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  script: z.string().min(10).max(10000).optional(),
  styleId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
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

    // Verify user has access to the sequence's team
    const { data: seq } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", sequenceId)
      .single();

    if (seq) {
      await requireTeamMemberAccess(user.id, seq.team_id);
    }

    const sequence = await sequenceService.getSequence(sequenceId, true);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/sequences/[sequenceId]] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get sequence",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
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

    // Parse and validate request body
    const body = await request.json();
    const validated = updateSequenceRequestSchema.parse(body);

    // Verify sequence exists and get team info
    const { data: existingSeq } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", sequenceId)
      .single();

    if (!existingSeq) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Verify user has access to this sequence
    await requireTeamMemberAccess(user.id, existingSeq.team_id);

    // Update sequence
    const sequence = await sequenceService.updateSequence({
      id: sequenceId,
      userId: user.id,
      name: validated.name,
      script: validated.script,
      styleId: validated.styleId === undefined ? undefined : validated.styleId,
    });

    // If script or style changed, regenerate frames
    if (validated.script !== undefined || validated.styleId !== undefined) {
      const supabase = createServerClient();

      // Check if sequence is already processing
      const { data: currentSeq } = await supabase
        .from("sequences")
        .select("status")
        .eq("id", sequenceId)
        .single();

      if (currentSeq?.status !== "processing") {
        // Trigger frame generation workflow
        const workflowInput: FrameGenerationWorkflowInput = {
          userId: user.id,
          teamId: existingSeq.team_id,
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
        await qstash.publishJSON({
          url: `${workflowConfig.baseUrl}/storyboard`,
          body: workflowInput,
        });
      }
    }

    // Revalidate paths
    revalidatePath(`/sequences/${sequenceId}`);
    revalidatePath(`/sequences/${sequenceId}/script`);
    revalidatePath(`/sequences/${sequenceId}/storyboard`);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        message: "Sequence updated successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/sequences/[sequenceId]] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update sequence",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
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

    // Get the sequence to verify team ownership
    const { data: sequence } = await supabase
      .from("sequences")
      .select("team_id")
      .eq("id", sequenceId)
      .single();

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          message: "Sequence not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Require admin access to delete
    await requireTeamMemberAccess(user.id, sequence.team_id, "admin");

    // Delete the sequence (frames will be cascade deleted)
    await sequenceService.deleteSequence(sequenceId);

    // Revalidate sequence pages
    revalidatePath("/sequences");
    revalidatePath(`/sequences/${sequenceId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Sequence deleted successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/sequences/[sequenceId]] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete sequence",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode }
    );
  }
}
