/**
 * API Authentication Utilities for BetterAuth
 * Provides helper functions for API route authentication and authorization
 */

import { getUserRole } from '@/lib/auth/permissions';
import type { Session, User } from './config';
import { getAuth } from './config';

interface AuthResult {
  user: User;
  session: Session;
}

/**
 * Authenticate API request and return user/session or error response
 */
async function authenticateApiRequest(request: Request) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json(
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

    return Response.json(
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
async function checkTeamAccess(request: Request, teamId: string) {
  const authResult = await authenticateApiRequest(request);

  // If authentication failed, return the error response
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  // Query database to verify actual team membership
  const role = await getUserRole(user.id, teamId);

  if (!role) {
    return Response.json(
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

  if (authResult instanceof Response) {
    throw authResult;
  }

  return authResult;
}

/**
 * Get optional user from API request
 * Returns user data or null if not authenticated
 */
async function getOptionalUser(request: Request): Promise<AuthResult | null> {
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
function createErrorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return Response.json(
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
function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
) {
  return Response.json(
    {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
