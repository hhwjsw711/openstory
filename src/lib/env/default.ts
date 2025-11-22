import { getCloudflareContext } from '@opennextjs/cloudflare';

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
