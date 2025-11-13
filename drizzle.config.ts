import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  throw new Error(
    'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required'
  );
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: tursoUrl,
    authToken: tursoToken,
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
