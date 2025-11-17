/**
 * Database Seed Script
 * Seeds the database with initial template styles and system team
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_SYSTEM_STYLES } from '@/lib/style/style-templates';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

const SYSTEM_TEAM_SLUG = 'system-templates';

async function seed() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  const client = createClient({
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }), // Only include if defined
  });
  const db = drizzle(client);

  try {
    console.log('🌱 Seeding database...\n');

    // 1. Find or create system team
    console.log('Finding or creating system team...');
    let [systemTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, SYSTEM_TEAM_SLUG));

    if (!systemTeam) {
      console.log('System team not found, creating...');
      const [newTeam] = await db
        .insert(teams)
        .values({
          name: 'System Templates',
          slug: SYSTEM_TEAM_SLUG,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: teams.id });
      systemTeam = newTeam;
      console.log(`✅ System team created with ID: ${systemTeam.id}\n`);
    } else {
      console.log(`✅ System team found with ID: ${systemTeam.id}\n`);
    }

    // 2. Check if template styles already exist
    console.log('Checking existing template styles...');
    const existingTemplates = await db
      .select()
      .from(styles)
      .where(eq(styles.teamId, systemTeam.id));

    if (existingTemplates.length > 0) {
      console.log(
        `ℹ️  Found ${existingTemplates.length} existing template styles - skipping insert`
      );
      console.log('✅ Templates already seeded\n');
    } else {
      // 3. Insert template film styles
      console.log('Inserting template styles...');
      await db.insert(styles).values(
        DEFAULT_SYSTEM_STYLES.map((style) => ({
          ...style,
          teamId: systemTeam.id, // Add system team ID
          createdBy: null, // No user for system templates
        })) as Array<typeof styles.$inferInsert>
      );

      console.log(
        `✅ Inserted ${DEFAULT_SYSTEM_STYLES.length} template styles\n`
      );
    }

    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    // Close client safely - HTTP clients may not need explicit close
    try {
      client.close?.();
    } catch (closeError) {
      console.warn('Warning: Could not close client cleanly:', closeError);
    }
  }
}

await seed();
