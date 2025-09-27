import { NextResponse } from "next/server";
import z from "zod";
import { generateImageByFalAction } from "#actions/generates/image";
import { FAL_IMAGE_MODELS } from "@/lib/ai/models";
import { extraParamsSchemaByModel } from "@/lib/ai/models-validation";
import { handleApiError } from "@/lib/errors";

const generateImageSchema = z
  .object({
    sequence_id: z.string(),
    frame_id: z.string(),
    model: z.enum(Object.keys(FAL_IMAGE_MODELS) as [string, ...string[]]),
    prompt: z.string(),
    extra_params: z.record(z.string(), z.any()).optional(),
  })
  .refine((data) => extraParamsSchemaByModel(data), {
    message:
      "[api/v1/generates/image] Generating image | extra_params validation failed for the selected model",
  });

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = generateImageSchema.parse(body);

    // Generate image with prompt
    const result = await generateImageByFalAction(validatedData);

    if (!result.success) {
      throw new Error(
        result.error || "[api/v1/generates/image] Generation failed",
      );
    }

    return NextResponse.json(
      {
        success: true,
        jobId: result.jobId,
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
