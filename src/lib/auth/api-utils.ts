/**
 * API Authentication Utilities for BetterAuth
 * Provides helper functions for API route authentication and authorization
 */

import type { Session, User } from './config';
import { getAuth } from './config';

type AuthResult = {
  user: User;
  session: Session;
};

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
