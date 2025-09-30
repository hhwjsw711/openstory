import {
  type GenerateImageInput,
  generateImageSchema,
} from "@/lib/ai/models-validation";
import type { FalGeneratedImageStatusResponse } from "./types";

//  Generate image by FAL Model
export async function generateImageByFalAction(
  input: GenerateImageInput,
): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const validated = generateImageSchema.parse(input);
    const params = {
      model: validated.model,
      sequence_id: validated.sequence_id,
      frame_id: validated.frame_id,
      prompt: validated.prompt,
      ...validated.extra_params,
    };
    if (process.env.NODE_ENV !== "production")
      console.log(
        "[actions/generates/image] Generating image with model",
        validated.model,
        "and params",
        params,
      );

    // Import QStash dependencies
    const { getJobManager } = await import("@/lib/qstash/job-manager");
    const { getQStashClient } = await import("@/lib/qstash/client");

    // Create a job for frame generation
    const jobManager = getJobManager();
    const job = await jobManager.createJob({
      type: "image",
      payload: params,
    });

    // Queue the frame generation job via QStash
    const qstashClient = getQStashClient();
    await qstashClient.publishImageJob({
      jobId: job.id,
      type: "image",
      data: params,
    });

    console.log("[actions/generates/image] Image generation job queued", {
      jobId: job.id,
    });

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    console.error("[actions/generates/image] Error generating image", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}

//  Get FAL generated image status by jobId
export async function fetchFalGeneratedImageStatusAction(
  jobId: string,
): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
  data?: FalGeneratedImageStatusResponse;
}> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data: jobData } = await supabase
    .from("jobs")
    .select(
      "team_id, user_id, type, status, payload, result, error, created_at, updated_at",
    )
    .eq("id", jobId)
    .single();

  console.log("[actions/generates/image] FAL generated image status by jobId", {
    jobData,
  });

  if (!jobData) {
    return {
      success: false,
      error: "[actions/generates/image] Record not found",
    };
  }

  return {
    success: true,
    jobId,
    data: jobData as unknown as FalGeneratedImageStatusResponse,
  };
}
