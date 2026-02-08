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
import {
  buildAuthorizationUrl,
  exchangeCodeForKey,
  type OAuthState,
} from '@/lib/services/openrouter-oauth';
import { apiKeyService } from '@/lib/services/api-key.service';
import { getServerAppUrl } from '@/lib/utils/environment';
import { Redis } from '@upstash/redis';
import { getEnv } from '#env';

function getRedis() {
  const env = getEnv();
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const OAUTH_STATE_PREFIX = 'openrouter-oauth:';
const OAUTH_STATE_TTL = 600; // 10 minutes

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
    const redis = getRedis();
    await redis.set(stateKey, JSON.stringify(state), { ex: OAUTH_STATE_TTL });

    return { authUrl: url };
  });

// ============================================================================
// Complete OAuth Flow (called from callback route)
// ============================================================================

/**
 * Complete the OpenRouter OAuth PKCE flow.
 * Called by the callback route after OpenRouter redirects back.
 */
export async function completeOpenRouterOAuth(
  teamId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const redis = getRedis();
  const stateKey = `${OAUTH_STATE_PREFIX}${teamId}`;

  // Retrieve and delete PKCE state
  const stateJson = await redis.get<string>(stateKey);
  if (!stateJson) {
    return { success: false, error: 'OAuth session expired or not found' };
  }
  await redis.del(stateKey);

  const state: OAuthState = JSON.parse(stateJson);

  // Exchange code for API key
  const { apiKey } = await exchangeCodeForKey(code, state.codeVerifier);

  // Save the key (encrypted)
  await apiKeyService.saveKey({
    teamId: state.teamId,
    provider: 'openrouter',
    apiKey,
    source: 'oauth',
    addedBy: state.userId,
  });

  return { success: true };
}
