/**
 * OpenRouter OAuth Callback Handler
 * Server-only — completes the OAuth PKCE flow after redirect.
 */

import { exchangeCodeForKey } from '@/lib/services/openrouter-oauth';
import type { OAuthState } from '@/lib/services/openrouter-oauth';
import { apiKeyService } from '@/lib/services/api-key.service';
import { getOAuthRedis, OAUTH_STATE_PREFIX } from './openrouter-oauth-utils';

/**
 * Complete the OpenRouter OAuth PKCE flow.
 * Called by the callback route after OpenRouter redirects back.
 * Throws on failure.
 */
export async function completeOpenRouterOAuth(
  teamId: string,
  code: string
): Promise<void> {
  const redis = getOAuthRedis();
  const stateKey = `${OAUTH_STATE_PREFIX}${teamId}`;

  // Retrieve and delete PKCE state
  const state = await redis.get<OAuthState>(stateKey);
  if (!state) {
    throw new Error('OAuth session expired or not found');
  }
  await redis.del(stateKey);

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
}
