import { getCloudflareContext } from '@opennextjs/cloudflare';

console.log('[env cloudflare] Loading context');
export const getEnv = () => getCloudflareContext().env;

export const getEnvAsync = async () =>
  (await getCloudflareContext({ async: true })).env;
