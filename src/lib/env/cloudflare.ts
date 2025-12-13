import { env } from 'cloudflare:workers';

export const getEnv = () => {
  return env;
};
