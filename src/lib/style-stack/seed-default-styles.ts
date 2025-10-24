import { db } from '@/lib/db/client';
import { styles, teams } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

import { DEFAULT_STYLE_TEMPLATES } from './default-templates';
/**
 * Service function to seed default templates into the database
 * This should be run during app initialization or migration
 */
export async function seedDefaultTemplates(): Promise<void> {
  try {
    // Create a system team for templates if it doesn't exist
    const systemTeamSlug = 'system-templates';

    let [systemTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, systemTeamSlug));

    if (!systemTeam) {
      // Team doesn't exist, create it
      const [newTeam] = await db
        .insert(teams)
        .values({
          name: 'System Templates',
          slug: systemTeamSlug,
        })
        .returning({ id: teams.id });

      if (!newTeam) {
        throw new Error('Failed to create system team');
      }

      systemTeam = newTeam;
    }

    if (!systemTeam) {
      throw new Error('System team is required but not found');
    }

    // Check which templates already exist
    const existingTemplates = await db
      .select({ name: styles.name })
      .from(styles)
      .where(
        and(eq(styles.teamId, systemTeam.id), eq(styles.isTemplate, true))
      );

    const existingNames = new Set(existingTemplates.map((t) => t.name));

    // Filter out templates that already exist
    const templatesToInsert = DEFAULT_STYLE_TEMPLATES.filter(
      (template) => !existingNames.has(template.name)
    ).map((template) => ({
      ...template,
      teamId: systemTeam.id,
    }));

    if (templatesToInsert.length === 0) {
      console.log('All default templates already exist');
      return;
    }

    // Insert new templates
    await db.insert(styles).values(templatesToInsert);

    console.log(
      `Successfully seeded ${templatesToInsert.length} default style templates`
    );
  } catch (error) {
    console.error('Failed to seed default templates:', error);
    throw error;
  }
}
