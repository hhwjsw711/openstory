import { defineConfig } from 'drizzle-kit';

const dbUrl = new URL(process.env.POSTGRES_URL_NON_POOLING!);
dbUrl.searchParams.set('sslmode', 'no-verify');

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl.toString(),
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
