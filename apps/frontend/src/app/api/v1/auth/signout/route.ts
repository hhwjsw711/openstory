/**
 * Sign Out API Endpoint
 * POST /api/v1/auth/signout - Sign out current user
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";

export async function POST() {
  try {
    const result = await signOut();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Failed to sign out",
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    revalidatePath("/");

    return NextResponse.json(
      {
        success: true,
        data: { message: "Signed out successfully" },
        message: "Signed out successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/v1/auth/signout] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to sign out",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
