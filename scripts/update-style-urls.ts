/**
 * Update Style URLs Script
 * Updates preview URLs for seed styles in local database to match seed script format
 *
 * Usage:
 *   bun scripts/update-style-urls.ts
 */

import { styles, teams } from '@/lib/db/schema';
import { DEFAULT_STYLE_TEMPLATES } from '@/lib/style/style-templates';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

const SYSTEM_TEAM_SLUG = 'system-templates';

/**
 * Get the R2 public assets domain from environment
 * Falls back to staging if not set
 */
function getPublicAssetsDomain(): string {
  const domain = process.env.R2_PUBLIC_ASSETS_DOMAIN ?? 'assets.velro.ai';
  return domain;
}

/**
 * Generate preview URL for a style (matches style-templates.ts)
 */
function getStylePreviewUrl(styleName: string): string {
  const sanitized = styleName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `https://${getPublicAssetsDomain()}/styles/${sanitized}/character.jpg`;
}

async function updateStyleUrls() {
  console.log('🗄️  Using local SQLite database (file:local.db)\n');
  const client = createClient({
    url: 'file:local.db',
  });

  const db = drizzle(client);

  try {
    console.log('🔍 Finding system team...');
    const [systemTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, SYSTEM_TEAM_SLUG));

    if (!systemTeam) {
      console.error('❌ System team not found. Run seed script first.');
      return;
    }

    console.log(`✅ System team found with ID: ${systemTeam.id}\n`);

    // Get all existing template styles
    console.log('🔍 Fetching existing template styles...');
    const existingStyles = await db
      .select({
        id: styles.id,
        name: styles.name,
        previewUrl: styles.previewUrl,
      })
      .from(styles)
      .where(eq(styles.teamId, systemTeam.id));

    console.log(`Found ${existingStyles.length} template styles\n`);

    // Create a map of expected URLs from templates
    const expectedUrls = new Map<string, string>();
    for (const template of DEFAULT_STYLE_TEMPLATES) {
      const expectedUrl = getStylePreviewUrl(template.name);
      expectedUrls.set(template.name, expectedUrl);
    }

    // Update URLs that don't match
    let updatedCount = 0;
    for (const style of existingStyles) {
      const expectedUrl = expectedUrls.get(style.name);
      if (!expectedUrl) {
        console.log(
          `⚠️  Style "${style.name}" not found in templates, skipping`
        );
        continue;
      }

      if (style.previewUrl !== expectedUrl) {
        console.log(`📝 Updating "${style.name}":`);
        console.log(`   Old: ${style.previewUrl || '(null)'}`);
        console.log(`   New: ${expectedUrl}`);

        await db
          .update(styles)
          .set({
            previewUrl: expectedUrl,
            updatedAt: new Date(),
          })
          .where(eq(styles.id, style.id));

        updatedCount++;
      } else {
        console.log(`✅ "${style.name}" already has correct URL`);
      }
    }

    console.log(`\n🎉 Updated ${updatedCount} style URL(s)!`);
  } catch (error) {
    console.error('❌ Error updating style URLs:', error);
    throw error;
  } finally {
    try {
      client.close?.();
    } catch (closeError) {
      console.warn('Warning: Could not close client cleanly:', closeError);
    }
  }
}

await updateStyleUrls();
