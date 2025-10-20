/**
 * User Profile API Endpoint
 * PATCH /api/v1/auth/profile - Update user profile
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/schemas/auth.schemas";

export async function PATCH(request: Request) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    // Update user in database
    const supabase = createServerClient();

    const { error } = await supabase
      .from("users")
      .update({
        full_name: validated.fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Failed to update profile: ${error.message}`,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        success: true,
        data: { message: "Profile updated successfully" },
        message: "Profile updated successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[PATCH /api/v1/auth/profile] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: error.issues,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update profile",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
