/**
 * Preview OAuth Initiation Endpoint
 *
 * This endpoint is called by preview deployments to initiate OAuth.
 * The OAuth state is created on production (this server), so the callback
 * can validate it properly.
 *
 * Flow:
 * 1. Preview redirects user to production's /api/auth/preview-oauth
 * 2. Production creates OAuth state and redirects to Google
 * 3. Google redirects to production's callback
 * 4. Production validates state (success!) and sees previewUrl
 * 5. Production generates JWT and redirects to preview
 */

import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/lib/auth/config';
import { isPreviewUrl } from '@/lib/auth/preview-transfer';

export const Route = createFileRoute('/api/auth/preview-oauth')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const previewUrl = url.searchParams.get('previewUrl');
        const callbackUrl = url.searchParams.get('callbackUrl') || '/sequences';

        // Validate previewUrl
        if (!previewUrl || !isPreviewUrl(previewUrl)) {
          return new Response('Invalid or missing previewUrl', { status: 400 });
        }

        console.log('[Preview OAuth] Initiating OAuth for preview', {
          previewUrl,
          callbackUrl,
          origin: url.origin,
        });

        // Use Better Auth's internal API to start OAuth with additionalData
        const auth = getAuth(request);

        const requestBody = {
          provider: 'google',
          callbackURL: callbackUrl,
          additionalData: {
            previewUrl,
            callbackUrl,
          },
        };
        console.log(
          '[Preview OAuth] Request body:',
          JSON.stringify(requestBody, null, 2)
        );

        // Call the sign-in/social handler with additionalData
        const signInRequest = new Request(
          `${url.origin}/api/auth/sign-in/social`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Set Origin header to satisfy Better Auth's CSRF check
              Origin: url.origin,
              // Forward cookies from original request
              Cookie: request.headers.get('Cookie') || '',
            },
            body: JSON.stringify(requestBody),
          }
        );

        // Get the response from Better Auth
        const response = await auth.handler(signInRequest);

        // Better Auth returns JSON with { url, redirect: true } for OAuth
        // We need to actually redirect the browser to that URL
        if (
          response.headers.get('Content-Type')?.includes('application/json')
        ) {
          const body: unknown = await response.json();

          // Type guard for Better Auth redirect response
          if (
            body !== null &&
            typeof body === 'object' &&
            'url' in body &&
            'redirect' in body &&
            typeof body.url === 'string' &&
            body.redirect === true
          ) {
            return new Response(null, {
              status: 302,
              headers: {
                Location: body.url,
                // Forward any cookies from the response (contains OAuth state)
                'Set-Cookie': response.headers.get('Set-Cookie') || '',
              },
            });
          }
        }

        // If not a redirect response, pass through as-is
        return response;
      },
    },
  },
});
