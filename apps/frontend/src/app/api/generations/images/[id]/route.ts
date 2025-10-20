import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getJobManager } from "@/lib/qstash/job-manager";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(
      "[api/generations/images/[id]] Image generation status request",
      {
        id,
      },
    );

    // Get job status from database
    const jobManager = getJobManager();
    const job = await jobManager.getJob(id);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: "Job not found",
        },
        { status: 404 },
      );
    }

    console.log(
      "[api/generations/images/[id]] Image generation status result",
      {
        status: job.status,
        jobId: job.id,
      },
    );

    return NextResponse.json(
      {
        success: true,
        message: "[api/generations/images/[id]] Generation status retrieved",
        data: {
          status: job.status,
          result: job.result,
          error: job.error,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[api/generations/images/[id]] Error getting the generated image status",
      error,
    );
    const velroError = handleApiError(error);
    return NextResponse.json(
      { error: velroError.message },
      { status: velroError.statusCode },
    );
  }
}
