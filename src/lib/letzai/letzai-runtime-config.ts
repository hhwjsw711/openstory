import type { CreateClientConfig } from '@/lib/letzai/sdk/client.gen';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  headers: {
    Authorization: `Bearer ${process.env.LETZAI_API_KEY}`,
    'Content-Type': 'application/json',
    ...config?.headers,
  },
});
