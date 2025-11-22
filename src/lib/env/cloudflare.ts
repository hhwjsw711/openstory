import { getCloudflareContext } from '@opennextjs/cloudflare';

console.log('[env cloudflare] Loading context');

export const getEnv = () => {
  const { env } = getCloudflareContext();
  if (!env) {
    throw new Error('Cloudflare context not found');
  }

  return env;
};
