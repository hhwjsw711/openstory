import { getEnv } from '#env';
import type { FlowControl } from '@upstash/qstash';

/**
 * Shared flow control configuration for Fal.ai requests.
 * Ensures we respect concurrency limits and rate limits across all AI workflows.
 */
export const getFalFlowControl = (): FlowControl => {
  const env = getEnv();
  const concurrencyLimit = env.FAL_CONCURRENCY_LIMIT
    ? parseInt(env.FAL_CONCURRENCY_LIMIT)
    : 20;

  return {
    key: 'fal-requests',
    parallelism: concurrencyLimit,
  };
};
