/**
 * OpenRouter OAuth PKCE Server Functions
 *
 * Handles the initiation and completion of the OpenRouter OAuth PKCE flow.
 * Uses Upstash Redis to store temporary PKCE state between redirect hops.
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { teamAdminAccessMiddleware } from './middleware';
import { buildAuthorizationUrl } from '@/lib/services/openrouter-oauth';
import { getServerAppUrl } from '@/lib/utils/environment';
import {
  getOAuthRedis,
  OAUTH_STATE_PREFIX,
  OAUTH_STATE_TTL,
} from './openrouter-oauth-utils';

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

    // Store PKCE state in Redis with a TTL
    const stateKey = `${OAUTH_STATE_PREFIX}${context.teamId}`;
    const redis = getOAuthRedis();
    await redis.set(stateKey, JSON.stringify(state), { ex: OAUTH_STATE_TTL });

    return { authUrl: url };
  });
