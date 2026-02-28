/**
 * OpenRouter OAuth Callback Handler
 * Server-only — completes the OAuth PKCE flow after redirect.
 */

import { exchangeCodeForKey } from '@/lib/byok/openrouter-oauth';
import { apiKeyService } from '@/lib/byok/api-key.service';
import { getAndDeleteOAuthState } from './openrouter-oauth-utils';

/**
 * Complete the OpenRouter OAuth PKCE flow.
 * Called by the callback route after OpenRouter redirects back.
 * Throws on failure.
 */
export async function completeOpenRouterOAuth(
  teamId: string,
  code: string
): Promise<void> {
  // Retrieve and delete PKCE state from DB
  const state = await getAndDeleteOAuthState(teamId);
  if (!state) {
    throw new Error('OAuth session expired or not found');
  }

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
