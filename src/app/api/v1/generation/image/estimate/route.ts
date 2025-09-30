import { NextResponse } from "next/server";
import z from "zod";
import { calculateFalCost, calculateFalTime } from "@/lib/ai/fal-client";
import { type FalImageModel, IMAGE_MODELS } from "@/lib/ai/models";
import { extraParamsSchemaByModel } from "@/lib/ai/models-validation";
import { handleApiError } from "@/lib/errors";

const estimateImageCostSchema = z
  .object({
    model: z.enum(Object.keys(IMAGE_MODELS) as [string, ...string[]]),
    prompt: z.string(),
    extra_params: z.record(z.string(), z.any()).optional(),
  })
  .refine((data) => extraParamsSchemaByModel(data), {
    message:
      "[api/v1/generation/image/estimate] Generating image | extra_params validation failed for the selected model",
  });

// calculate cost for image generation
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = estimateImageCostSchema.parse(body);

    const modelKey = validatedData.model as keyof typeof IMAGE_MODELS;
    const model = IMAGE_MODELS[modelKey] as FalImageModel;
    const costResult = calculateFalCost(
      model,
      validatedData.extra_params || {},
    );
    const timeResult = calculateFalTime(
      model,
      validatedData.extra_params || {},
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          cost: costResult,
          time: timeResult,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const velroError = handleApiError(error);
    return NextResponse.json(
      { error: velroError.message },
      { status: velroError.statusCode },
    );
  }
}
