import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    'POSTGRES_URL or POSTGRES_URL_NON_POOLING environment variable is required'
  );
}

const dbUrl = new URL(connectionString);

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
