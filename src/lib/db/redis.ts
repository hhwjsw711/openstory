import { Redis } from '@upstash/redis';
import { getEnv } from '@/lib/env/default';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  const env = getEnv() as Record<string, string | undefined>;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required for Realtime features'
    );
  }

  redis = new Redis({ url, token });
  return redis;
}
