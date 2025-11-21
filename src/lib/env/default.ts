import { getCloudflareContext } from '@opennextjs/cloudflare';

console.log('[env cloudflare] Loading context');

export const getEnv = () => {
  if (process.env.BUILD_CLOUDFLARE) {
    const { env } = getCloudflareContext();
    if (!env) {
      throw new Error('Cloudflare context not found');
    }

    return env;
  } else {
    return process.env;
  }
};
