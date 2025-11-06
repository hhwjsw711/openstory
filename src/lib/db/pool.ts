import pg from 'pg';

const { Pool } = pg;

const conn = process.env.POSTGRES_URL;
if (!conn) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const isLocalDevelopment =
  conn.includes('localhost') || conn.includes('127.0.0.1');

const dbUrl = new URL(conn);

export const pgPool = new Pool({
  connectionString: dbUrl.toString(),

  // Serverless-optimized settings
  max: isLocalDevelopment ? 10 : 1, // Only 1 connection per serverless instance
  idleTimeoutMillis: 20000, // Close idle connections after 20s
  connectionTimeoutMillis: 10000, // Timeout if connection takes >10s
  maxUses: 7500, // Recycle connection after 7500 uses (pgbouncer best practice)
  // Only enable SSL for production connections
  ssl: isLocalDevelopment ? false : { rejectUnauthorized: true },
});
