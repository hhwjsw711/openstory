/**
 * OpenRouter OAuth PKCE Server Functions
 *
 * Handles the initiation of the OpenRouter OAuth PKCE flow.
 * Uses Turso DB to store temporary PKCE state between redirect hops.
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { teamAdminAccessMiddleware } from './middleware';
import { buildAuthorizationUrl } from '@/lib/byok/openrouter-oauth';
import { getServerAppUrl } from '@/lib/utils/environment';
import { saveOAuthState } from './openrouter-oauth-utils';

// ============================================================================
// Initiate OAuth Flow
// ============================================================================

const initiateOAuthInputSchema = z.object({
  teamId: z.string(),
});

/**
 * Start the OpenRouter OAuth PKCE flow.
 * Returns a URL to redirect the user to OpenRouter's auth page.
 */
export const initiateOpenRouterOAuthFn = createServerFn({ method: 'POST' })
  .middleware([teamAdminAccessMiddleware])
  .inputValidator(zodValidator(initiateOAuthInputSchema))
  .handler(async ({ context }) => {
    const request = getRequest();
    const appUrl = getServerAppUrl(request);
    const callbackUrl = `${appUrl}/api/openrouter/callback`;

    const { url, state } = await buildAuthorizationUrl(
      callbackUrl,
      context.teamId,
      context.user.id
    );

    // Store PKCE state in DB with TTL
    await saveOAuthState(context.teamId, state);

    return { authUrl: url };
  });
