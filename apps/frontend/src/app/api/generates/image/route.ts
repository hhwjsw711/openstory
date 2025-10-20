import { NextResponse } from "next/server";
import { generateImageSchema } from "@/lib/ai/models-validation";
import { handleApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/action-utils";
import { createServerClient } from "@/lib/supabase/server";
import { getQStashClient } from "@/lib/qstash/client";
import { getJobManager } from "@/lib/qstash/job-manager";

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

    // 4. Create job record
    const jobManager = getJobManager();
    const job = await jobManager.createJob({
      type: "image",
      payload: validatedData.data,
      userId: user.id,
      teamId: membership.team_id,
    });

    // 5. Queue the job via QStash
    const qstashClient = getQStashClient();
    await qstashClient.publishImageJob(
      {
        jobId: job.id,
        type: "image",
        userId: user.id,
        teamId: membership.team_id,
        data: validatedData.data,
      },
      {
        deduplicationId: job.id,
      },
    );

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/v1/generates/image] Error generating image", error);
    const velroError = handleApiError(error);
    return NextResponse.json(
      { error: velroError.message },
      { status: velroError.statusCode },
    );
  }
}
