/**
 * System Templates Migration Script
 * Updates existing system template styles with new data from DEFAULT_SYSTEM_STYLES
 *
 * Usage: bun --bun scripts/migrate-system-templates.ts
 *
 * This is a one-time migration script that:
 * - Updates only system templates in the "system-templates" team
 * - Matches templates by name for reliable identification
 * - Preserves: id, teamId, createdAt, usageCount
 * - Updates: all other fields with latest template data
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_SYSTEM_STYLES } from '@/lib/style/style-templates';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

const SYSTEM_TEAM_SLUG = 'system-templates';

type UpdateResult = {
  name: string;
  status: 'updated' | 'skipped' | 'failed';
  error?: Error;
};

async function migrateSystemTemplates() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  const client = createClient({
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }),
  });
  const db = drizzle(client);

  try {
    console.log('🔄 Updating system template styles...\n');

    // 1. Find system team
    console.log('Finding system team...');
    const [systemTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, SYSTEM_TEAM_SLUG));

    if (!systemTeam) {
      throw new Error(
        `System team "${SYSTEM_TEAM_SLUG}" not found. Run seed script first.`
      );
    }
    console.log(`✅ System team found (ID: ${systemTeam.id})\n`);

    // 2. Fetch existing templates
    console.log('Fetching existing templates...');
    const existingStyles = await db
      .select()
      .from(styles)
      .where(eq(styles.teamId, systemTeam.id));

    console.log(`ℹ️  Found ${existingStyles.length} existing templates\n`);

    // 3. Build lookup map (O(1) access by name)
    const stylesByName = new Map(existingStyles.map((s) => [s.name, s]));

    // 4. Update each template
    console.log('Updating templates:');
    const results: UpdateResult[] = [];
    let index = 1;

    for (const template of DEFAULT_SYSTEM_STYLES) {
      const existing = stylesByName.get(template.name);

      if (!existing) {
        console.log(`  ${index}. ⚠️  ${template.name} (not found in database)`);
        results.push({
          name: template.name,
          status: 'skipped',
        });
        index++;
        continue;
      }

      try {
        await db
          .update(styles)
          .set({
            name: template.name,
            description: template.description,
            config: template.config,
            category: template.category,
            tags: template.tags,
            isPublic: template.isPublic,
            isTemplate: template.isTemplate,
            version: template.version,
            previewUrl: template.previewUrl,
            createdBy: null,
            updatedAt: new Date(),
            // Preserve: id, teamId, createdAt, usageCount
          })
          .where(eq(styles.id, existing.id));

        console.log(`  ${index}. ✅ ${template.name}`);
        results.push({
          name: template.name,
          status: 'updated',
        });
      } catch (error) {
        console.log(`  ${index}. ❌ ${template.name} (failed)`);
        results.push({
          name: template.name,
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      index++;
    }

    // 5. Report results
    console.log('\nSummary:');
    const updated = results.filter((r) => r.status === 'updated').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);

    // Log any failures with details
    const failures = results.filter((r) => r.status === 'failed');
    if (failures.length > 0) {
      console.log('\nFailed updates:');
      failures.forEach((f) => {
        console.log(`  - ${f.name}: ${f.error?.message}`);
      });
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    // Close client safely
    try {
      client.close?.();
    } catch (closeError) {
      console.warn('Warning: Could not close client cleanly:', closeError);
    }
  }
}

await migrateSystemTemplates();
