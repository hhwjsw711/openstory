import { env } from 'cloudflare:workers';
console.log('cloudflare env');
export const getEnv = () => {
  return env;
};
