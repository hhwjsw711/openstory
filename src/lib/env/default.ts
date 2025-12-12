import { env } from 'cloudflare:workers';

export const getEnv = () => {
  if (process.env.BUILD_CLOUDFLARE) {
    return env;
  }
  return process.env;
};
