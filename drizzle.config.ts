import { defineConfig } from 'drizzle-kit';

console.log({
  dbCredentials: {
    url: process.env.POSTGRES_NON_POOLING_URL!,
  },
});

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING!,
    ssl: {
      ca: process.env.DATABASE_CERTIFICATE!,
    },
  },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
