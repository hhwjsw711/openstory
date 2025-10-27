import { defineConfig } from 'drizzle-kit';

const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING;
if (!POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: POSTGRES_URL,
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
