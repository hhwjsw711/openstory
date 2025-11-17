import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL environment variable is required');
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }), // Only include if defined
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
