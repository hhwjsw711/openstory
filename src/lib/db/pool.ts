import pg from 'pg';

const { Pool } = pg;

const conn = process.env.POSTGRES_URL;
if (!conn) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const isLocalDevelopment =
  conn.includes('localhost') || conn.includes('127.0.0.1');

const dbUrl = new URL(conn);

// Only configure SSL for production (when not local)
if (!isLocalDevelopment) {
  dbUrl.searchParams.set('sslmode', 'no-verify');
}

export const pgPool = new Pool({
  connectionString: dbUrl.toString(),
  // Only enable SSL for production connections
  ssl: isLocalDevelopment ? false : { rejectUnauthorized: false },
});
