/**
 * OpenRouter OAuth shared utilities
 * Extracted to avoid pulling server-only deps into client bundles.
 */

import { Redis } from '@upstash/redis';
import { getEnv } from '#env';

export const OAUTH_STATE_PREFIX = 'openrouter-oauth:';
export const OAUTH_STATE_TTL = 600; // 10 minutes

export function getOAuthRedis() {
  const env = getEnv();
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}
