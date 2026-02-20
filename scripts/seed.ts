/**
 * Database Seed Script
 * Seeds the database with initial template styles and system team
 *
 * Usage:
 *   bun db:seed           # Seed Turso database (requires TURSO_DATABASE_URL)
 *   bun db:seed:local     # Seed local SQLite database (file:local.db)
 *   bun db:seed:test      # Seed e2e test database (file:test.db)
 *   bun db:seed:d1        # Seed Cloudflare D1 via HTTP API
 */

import { createD1HttpClient } from '@/lib/db/client-d1-http';
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
    d1: args.includes('--d1'),
  };
}

async function seed() {
  const { local, test, d1 } = parseArgs();

  let client: ReturnType<typeof createClient> | undefined;
  let db: ReturnType<typeof drizzle> | ReturnType<typeof createD1HttpClient>;

  if (d1) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !databaseId || !token) {
      throw new Error(
        'CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN are required for --d1'
      );
    }
    console.log('🗄️  Using Cloudflare D1 via HTTP API\n');
    db = createD1HttpClient({
      accountId,
      databaseId,
      token,
    });
  } else if (test) {
    console.log('🗄️  Using e2e test database (file:test.db)\n');
    client = createClient({
      url: 'file:test.db',
    });
    db = drizzle(client);
  } else if (local) {
    console.log('🗄️  Using local SQLite database (file:local.db)\n');
    client = createClient({
      url: 'file:local.db',
    });
    db = drizzle(client);
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
    db = drizzle(client);
  }

  try {
    console.log('🌱 Seeding database...\n');

    // 1. Find or create system team
    console.log('Finding or creating system team...');
    let [systemTeam]: { id: string }[] = await db
      .select()
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
      .select()
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
    client?.close();
  }
}

await seed();
