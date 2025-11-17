#!/usr/bin/env bun
/**
 * Update sequence aspect ratio
 * Usage: bun scripts/update-sequence-aspect-ratio.ts <sequence-id> <aspect-ratio>
 * Example: bun scripts/update-sequence-aspect-ratio.ts abc-123 9:16
 */

import { sequences } from '@/lib/db/schema';
import type { AspectRatio } from '@/lib/constants/aspect-ratios';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const sequenceId = process.argv[2];
const aspectRatio = process.argv[3] as AspectRatio;

if (!sequenceId || !aspectRatio) {
  console.error(
    'Usage: bun scripts/update-sequence-aspect-ratio.ts <sequence-id> <aspect-ratio>'
  );
  console.error(
    'Example: bun scripts/update-sequence-aspect-ratio.ts abc-123 9:16'
  );
  console.error('Valid aspect ratios: 16:9, 9:16, 1:1');
  process.exit(1);
}

// Validate aspect ratio
const validAspectRatios: AspectRatio[] = ['16:9', '9:16', '1:1'];
if (!validAspectRatios.includes(aspectRatio)) {
  console.error(`Invalid aspect ratio: ${aspectRatio}`);
  console.error(`Valid aspect ratios: ${validAspectRatios.join(', ')}`);
  process.exit(1);
}

async function updateAspectRatio() {
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
    // Check if sequence exists and get current aspect ratio
    const [sequence] = await db
      .select({
        id: sequences.id,
        title: sequences.title,
        aspectRatio: sequences.aspectRatio,
      })
      .from(sequences)
      .where(eq(sequences.id, sequenceId))
      .limit(1);

    if (!sequence) {
      console.error(`❌ Sequence not found: ${sequenceId}`);
      client.close();
      process.exit(1);
    }

    console.log('\n📊 Current sequence:');
    console.log(`   ID: ${sequence.id}`);
    console.log(`   Title: ${sequence.title}`);
    console.log(
      `   Current aspect ratio: ${sequence.aspectRatio || 'null (defaults to 16:9)'}`
    );

    // Update aspect ratio
    const [updated] = await db
      .update(sequences)
      .set({ aspectRatio, updatedAt: new Date() })
      .where(eq(sequences.id, sequenceId))
      .returning();

    console.log('\n✅ Successfully updated aspect ratio!');
    console.log(`   New aspect ratio: ${updated.aspectRatio}`);
    console.log('\n💡 Refresh your browser to see the changes.');
  } catch (error) {
    console.error('❌ Error updating aspect ratio:', error);
    client.close();
    process.exit(1);
  } finally {
    client.close();
    process.exit(0);
  }
}

updateAspectRatio();
