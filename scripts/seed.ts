/**
 * Database Seed Script
 * Seeds the database with initial template styles and system team
 *
 * Usage:
 *   bun db:seed           # Seed Turso database (requires TURSO_DATABASE_URL)
 *   bun db:seed:local     # Seed local SQLite database (file:local.db)
 *   bun db:seed:test      # Seed e2e test database (file:test.db)
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_SYSTEM_STYLES } from '@/lib/style/style-templates';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

const SYSTEM_TEAM_SLUG = 'system-templates';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    local: args.includes('--local'),
    test: args.includes('--test'),
  };
}

async function seed() {
  const { local, test } = parseArgs();

  let client;

  if (test) {
    console.log('🗄️  Using e2e test database (file:test.db)\n');
    client = createClient({
      url: 'file:test.db',
    });
  } else if (local) {
    console.log('🗄️  Using local SQLite database (file:local.db)\n');
    client = createClient({
      url: 'file:local.db',
    });
  } else {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl) {
      throw new Error(
        'TURSO_DATABASE_URL is required (use --local for local.db)'
      );
    }

    console.log('🗄️  Using Turso database\n');
    client = createClient({
      url: tursoUrl,
      ...(tursoToken && { authToken: tursoToken }),
    });
  }

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

    // 2. Check which templates already exist
    console.log('Checking existing template styles...');
    const existingTemplates = await db
      .select({ name: styles.name })
      .from(styles)
      .where(eq(styles.teamId, systemTeam.id));

    const existingNames = new Set(existingTemplates.map((t) => t.name));
    console.log(
      `ℹ️  Found ${existingTemplates.length} existing template styles`
    );

    // Filter out templates that already exist
    const templatesToInsert = DEFAULT_SYSTEM_STYLES.filter(
      (template) => !existingNames.has(template.name)
    );

    if (templatesToInsert.length === 0) {
      console.log('✅ All templates already exist - nothing to add\n');
    } else {
      // 3. Insert only new template styles
      console.log(
        `Inserting ${templatesToInsert.length} new template style(s)...`
      );
      await db.insert(styles).values(
        templatesToInsert.map((style) => ({
          ...style,
          teamId: systemTeam.id, // Add system team ID
          createdBy: null, // No user for system templates
        })) as Array<typeof styles.$inferInsert>
      );

      console.log(
        `✅ Inserted ${templatesToInsert.length} new template style(s):`
      );
      templatesToInsert.forEach((style) => {
        console.log(`   - ${style.name}`);
      });
      console.log();
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
