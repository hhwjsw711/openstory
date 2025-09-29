import { NextResponse } from "next/server";
import { generateImageByFalAction } from "#actions/generates/image";
import { generateImageSchema } from "@/lib/ai/models-validation";
import { handleApiError } from "@/lib/errors";

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
