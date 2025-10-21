/**
 * Sequences API Endpoint
 * POST /api/sequences - Create a new sequence
 * GET /api/sequences - List all sequences for the user's team
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/action-utils";
import { handleApiError } from "@/lib/errors";
import { createSequenceSchema } from "@/lib/schemas/sequence.schemas";
import { sequenceService } from "@/lib/services/sequence.service";
import { createServerClient } from "@/lib/supabase/server";
import type { FrameGenerationWorkflowInput } from "@/lib/workflow";
import { workflowConfig } from "@/lib/workflow";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    console.log("[POST /api/sequences] Request body:", body);
    const validated = createSequenceSchema.parse(body);
    console.log("[POST /api/sequences] Validated data:", validated);

    const supabase = createServerClient();

    // Get user's team
    const { data: teamMemberships, error: teamError } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .order("role", { ascending: true })
      .limit(1);

    if (teamError || !teamMemberships || teamMemberships.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No team found for user. Please refresh the page to initialize your account.",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const teamId = teamMemberships[0].team_id;

    // Create sequence
    const createParams = {
      teamId,
      userId: user.id,
      name: validated.name,
      script: validated.script,
      styleId: validated.style_id || undefined,
    };
    console.log(
      "[POST /api/sequences] Creating sequence with params:",
      createParams,
    );
    const sequence = await sequenceService.createSequence(createParams);
    console.log("[POST /api/sequences] Created sequence:", {
      id: sequence.id,
      style_id: sequence.style_id,
    });

    // Generate frames asynchronously via workflow
    const workflowInput: FrameGenerationWorkflowInput = {
      userId: user.id,
      teamId,
      sequenceId: sequence.id,
      options: {
        framesPerScene: 3,
        generateThumbnails: true,
        generateDescriptions: true,
        aiProvider: "openrouter",
        regenerateAll: true,
      },
    };

    await fetch(`${workflowConfig.baseUrl}/frame-generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workflowInput),
    });

    // Revalidate paths
    revalidatePath(`/sequences/${sequence.id}`);
    revalidatePath(`/sequences/${sequence.id}/script`);
    revalidatePath(`/sequences/${sequence.id}/storyboard`);

    return NextResponse.json(
      {
        success: true,
        data: sequence,
        message: "Sequence created successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/sequences] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create sequence",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}

export async function GET() {
  try {
    // Authenticate user
    const user = await requireUser();
    const supabase = createServerClient();

    // Get user's team
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      // No team membership yet, return empty array
      return NextResponse.json(
        {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const sequences = await sequenceService.getSequencesByTeam(
      membership.team_id,
    );

    return NextResponse.json(
      {
        success: true,
        data: sequences,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/sequences] Error:", error);
    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to list sequences",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
