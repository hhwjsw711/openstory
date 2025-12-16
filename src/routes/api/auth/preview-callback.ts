/**
 * Preview OAuth Callback Handler
 *
 * Receives JWT from production after OAuth success,
 * creates user/session on preview database, sets cookie.
 */

import { createFileRoute } from '@tanstack/react-router';
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
          const { sessionToken, callbackUrl } =
            await createPreviewSession(payload);

          // Build redirect URL
          const redirectUrl = new URL(callbackUrl, request.url);

          console.log('[Preview Callback] Session created, redirecting', {
            userId: payload.sub,
            callbackUrl: redirectUrl.toString(),
          });

          // Set session cookie and redirect
          // Cookie name matches Better Auth's default: better-auth.session_token
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              'Set-Cookie': buildSessionCookie(sessionToken, request),
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
 * Build session cookie string for Better Auth
 */
function buildSessionCookie(sessionToken: string, request: Request): string {
  const isSecure = request.url.startsWith('https://');
  const maxAge = 90 * 24 * 60 * 60; // 90 days in seconds

  const parts = [
    `better-auth.session_token=${sessionToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
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
