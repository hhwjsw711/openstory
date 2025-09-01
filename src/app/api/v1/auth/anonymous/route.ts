import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/lib/auth/service";

const createAnonymousSessionSchema = z.object({
  data: z.record(z.unknown()).optional(),
});

/**
 * Create a new anonymous session
 * POST /api/v1/auth/anonymous
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Validate input
    const { data: initialData } = createAnonymousSessionSchema.parse(body);

    // Create anonymous session
    const authService = new AuthService();
    const session = await authService.createAnonymousSession(initialData);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expires_at,
        data: session.data,
      },
    });
  } catch (error) {
    console.error("Create anonymous session error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create anonymous session",
      },
      { status: 500 },
    );
  }
}

/**
 * Get anonymous session data
 * GET /api/v1/auth/anonymous?sessionId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Session ID is required",
        },
        { status: 400 },
      );
    }

    const authService = new AuthService();
    const session = await authService.getAnonymousSession(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found or expired",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expires_at,
        data: session.data,
        teamId: session.team_id,
      },
    });
  } catch (error) {
    console.error("Get anonymous session error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get anonymous session",
      },
      { status: 500 },
    );
  }
}

/**
 * Update anonymous session data
 * PATCH /api/v1/auth/anonymous
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const updateSchema = z.object({
      sessionId: z.string(),
      data: z.record(z.unknown()),
    });

    const { sessionId, data } = updateSchema.parse(body);

    const authService = new AuthService();
    const session = await authService.updateAnonymousSession(sessionId, data);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expires_at,
        data: session.data,
      },
    });
  } catch (error) {
    console.error("Update anonymous session error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update anonymous session",
      },
      { status: 500 },
    );
  }
}
