import { getCloudflareContext } from '@opennextjs/cloudflare';

console.log('[env cloudflare] Loading context');

export const getEnv = () => {
  const { env } = getCloudflareContext();
  if (!env) {
    throw new Error('Cloudflare context not found');
  }

  return env;
};

export const getEnvAsync = async () => {
  const { env } = await getCloudflareContext({ async: true });
  if (!env) {
    throw new Error('Cloudflare context not found');
  }

  return env;
};
