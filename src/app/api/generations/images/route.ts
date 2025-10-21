/**
 * Standalone Image Generation API
 * POST /api/generations/images - Generate images without frame association
 */

import { NextResponse } from "next/server";
import { generateImageSchema } from "@/lib/ai/models-validation";
import { requireUser } from "@/lib/auth/action-utils";
import { handleApiError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import type { ImageWorkflowInput } from "@/lib/workflow";
import { getQStashClient, workflowConfig } from "@/lib/workflow";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const user = await requireUser();

    // 2. Parse and validate request body
    const body = await request.json();
    const validatedData = generateImageSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        {
          success: false,
          error: validatedData.error.message,
        },
        { status: 400 },
      );
    }

    // 3. Get user's team
    const supabase = createServerClient();
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: "No team found for user",
        },
        { status: 404 },
      );
    }

    // 4. Trigger image generation workflow
    const workflowInput: ImageWorkflowInput = {
      userId: user.id,
      teamId: membership.team_id,
      ...validatedData.data,
    };

    // Publish to QStash to trigger the workflow
    const qstash = getQStashClient();
    const { messageId } = await qstash.publishJSON({
      url: `${workflowConfig.baseUrl}/image`,
      body: workflowInput,
    });

    const workflowRunId = messageId;

    return NextResponse.json(
      {
        success: true,
        data: {
          workflowRunId,
          message: "Image generation started",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/generations/images] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        error: handledError.message,
      },
      { status: handledError.statusCode },
    );
  }
}
