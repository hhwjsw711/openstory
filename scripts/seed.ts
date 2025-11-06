/**
 * Database Seed Script
 * Seeds the database with initial template styles and system team
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const SYSTEM_TEAM_ID = '00000000-0000-0000-0000-000000000000';

async function seed() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isLocalDevelopment =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  const dbUrl = new URL(connectionString);

  // Only configure SSL for production (when not local)
  if (!isLocalDevelopment) {
    dbUrl.searchParams.set('sslmode', 'no-verify');
  }

  const pool = new Pool({
    connectionString: dbUrl.toString(),
    // Only enable SSL for production connections
    ssl: isLocalDevelopment ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  try {
    console.log('🌱 Seeding database...\n');

    // 1. Create system team if it doesn't exist
    console.log('Creating system team...');
    await db
      .insert(teams)
      .values({
        id: SYSTEM_TEAM_ID,
        name: 'System Templates',
        slug: 'system-templates',
      })
      .onConflictDoNothing();
    console.log('✅ System team created\n');

    // 2. Check if template styles already exist
    console.log('Checking existing template styles...');
    const existingTemplates = await db
      .select()
      .from(styles)
      .where(eq(styles.teamId, SYSTEM_TEAM_ID));

    if (existingTemplates.length > 0) {
      console.log(
        `ℹ️  Found ${existingTemplates.length} existing template styles - skipping insert`
      );
      console.log('✅ Templates already seeded\n');
    } else {
      // 3. Insert template film styles
      console.log('Inserting template styles...');
      await db.insert(styles).values(
        DEFAULT_STYLE_TEMPLATES.map((style) => ({
          ...style,
          teamId: SYSTEM_TEAM_ID,
        }))
      );

      console.log(
        `✅ Inserted ${DEFAULT_STYLE_TEMPLATES.length} template styles\n`
      );
    }

    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

await seed();
