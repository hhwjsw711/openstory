/**
 * API Authentication Utilities for BetterAuth
 * Provides helper functions for API route authentication and authorization
 */

import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/auth/permissions';
import type { Session, User } from './config';
import { getAuth } from './config';

interface AuthResult {
  user: User;
  session: Session;
}

interface AuthError {
  success: false;
  message: string;
  status: number;
  timestamp: string;
}

/**
 * Authenticate API request and return user/session or error response
 */
export async function authenticateApiRequest(
  request: Request
): Promise<AuthResult | NextResponse<AuthError>> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          status: 401,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    return {
      user: session.user,
      session: session,
    };
  } catch (error) {
    console.error('[API Auth] Authentication error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Authentication failed',
        status: 401,
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }
}

/**
 * Check if user has access to a team resource
 *
 * SECURITY: Queries database to verify actual team membership
 * instead of relying on optional user.teamId field
 */
export async function checkTeamAccess(
  request: Request,
  teamId: string
): Promise<AuthResult | NextResponse<AuthError>> {
  const authResult = await authenticateApiRequest(request);

  // If authentication failed, return the error response
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Query database to verify actual team membership
  const role = await getUserRole(user.id, teamId);

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        message: 'Access denied',
        status: 403,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Require authenticated user for API route
 * Returns user data or throws error response
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const authResult = await authenticateApiRequest(request);

  if (authResult instanceof NextResponse) {
    throw authResult;
  }

  return authResult;
}

/**
 * Get optional user from API request
 * Returns user data or null if not authenticated
 */
export async function getOptionalUser(
  request: Request
): Promise<AuthResult | null> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return null;
    }

    return {
      user: session.user,
      session: session,
    };
  } catch (error) {
    console.error('[API Auth] Optional auth error:', error);
    return null;
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse<AuthError> {
  return NextResponse.json(
    {
      success: false,
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<{
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
