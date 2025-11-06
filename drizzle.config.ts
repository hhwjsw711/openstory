import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL or DATABASE_URL_NON_POOLING environment variable is required'
  );
}

const isLocalDevelopment =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

const dbUrl = new URL(connectionString);

// Only configure SSL for production (when not local)
if (!isLocalDevelopment) {
  dbUrl.searchParams.set('sslmode', 'no-verify');
}

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
