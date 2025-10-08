// lib/db/pool.ts
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ?? "";

const requiresSsl =
  /[?&]sslmode=(require|verify-full)\b/i.test(connectionString) ||
  process.env.NODE_ENV === "production";

export const pgPool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
});
