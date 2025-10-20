/**
 * Auth Session API Endpoint
 * GET /api/v1/auth/session - Get current user session
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "No active session",
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: session.user,
          session: session.session,
          isAuthenticated: session.user.isAnonymous !== true,
          isAnonymous: session.user.isAnonymous === true,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/v1/auth/session] Error:", error);

    const handledError = handleApiError(error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get session",
        error: handledError.toJSON(),
        timestamp: new Date().toISOString(),
      },
      { status: handledError.statusCode },
    );
  }
}
