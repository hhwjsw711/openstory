/**
 * Preview OAuth Callback Handler
 *
 * Receives JWT from production after OAuth success,
 * creates user/session on preview database, sets cookie.
 */

import { createFileRoute } from '@tanstack/react-router';
import { serializeSignedCookie } from 'better-call';

import { getEnv } from '#env';
import {
  createPreviewSession,
  verifyPreviewTransferToken,
} from '@/lib/auth/preview-transfer';

export const Route = createFileRoute('/api/auth/preview-callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get('token');

        if (!token) {
          console.error('[Preview Callback] Missing token');
          return redirectWithError(request, 'Missing authentication token');
        }

        try {
          // Verify and decode JWT
          const payload = await verifyPreviewTransferToken(token);

          console.log('[Preview Callback] Token verified', {
            userId: payload.sub,
            email: payload.email,
          });

          // Create user (if needed) and session on preview DB
          const { sessionToken, callbackUrl, userId } =
            await createPreviewSession(payload);

          // Build redirect URL
          const redirectUrl = new URL(callbackUrl, request.url);

          // Build signed cookie (Better Auth expects signed cookies)
          const cookie = await buildSignedSessionCookie(sessionToken, request);

          console.log('[Preview Callback] Session created, redirecting', {
            userId,
            sessionToken: sessionToken.substring(0, 10) + '...',
            cookie: cookie.substring(0, 50) + '...',
            callbackUrl: redirectUrl.toString(),
          });

          // Set session cookie and redirect
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              'Set-Cookie': cookie,
            },
          });
        } catch (error) {
          console.error('[Preview Callback] Error:', error);

          const message =
            error instanceof Error ? error.message : 'Authentication failed';
          return redirectWithError(request, message);
        }
      },
    },
  },
});

/**
 * Build signed session cookie string for Better Auth
 * Uses serializeSignedCookie from better-call to match Better Auth's format
 */
async function buildSignedSessionCookie(
  sessionToken: string,
  request: Request
): Promise<string> {
  const isSecure = request.url.startsWith('https://');
  const maxAge = 90 * 24 * 60 * 60; // 90 days in seconds

  // Better Auth uses __Secure- prefix on HTTPS contexts
  const cookieName = isSecure
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token';

  const secret = getEnv().BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET not configured');
  }

  // Use better-call's serializeSignedCookie to sign the token
  // This creates the format: {token}.{hmac-signature}
  return serializeSignedCookie(cookieName, sessionToken, secret, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge,
    secure: isSecure,
  });
}

/**
 * Redirect to login page with error message
 */
function redirectWithError(request: Request, message: string): Response {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'preview_transfer_failed');
  loginUrl.searchParams.set('message', message);

  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl.toString(),
    },
  });
}
