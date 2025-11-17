/**
 * Database Seed Script
 * Seeds the database with initial template styles and system team
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const SYSTEM_TEAM_ID = '00000000-0000-0000-0000-000000000000';

async function seed() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  }

  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
  const db = drizzle(client);

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
    client.close();
  }
}

await seed();
