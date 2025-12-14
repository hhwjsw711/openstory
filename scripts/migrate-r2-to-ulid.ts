#!/usr/bin/env bun
/**
 * Migration Script: Rename R2 files from thumbnail.jpg/motion.mp4 to ULID-based names
 *
 * Usage:
 *   bun scripts/migrate-r2-to-ulid.ts --local              # Dry run on local.db
 *   bun scripts/migrate-r2-to-ulid.ts --local --execute    # Execute on local.db
 *   bun scripts/migrate-r2-to-ulid.ts --local --cleanup    # Cleanup old files
 *   bun scripts/migrate-r2-to-ulid.ts                      # Dry run on Turso (requires env vars)
 */

import { frames } from '@/lib/db/schema/frames';
import {
  copyFile,
  deleteFile,
  fileExists,
  STORAGE_BUCKETS,
  type StorageBucket,
} from '@/lib/db/helpers/storage';
import { generateId } from '@/lib/db/id';
import { createClient } from '@libsql/client';
import { eq, isNotNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { writeFileSync } from 'fs';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    local: args.includes('--local'),
    execute: args.includes('--execute'),
    cleanup: args.includes('--cleanup'),
  };
}

function createDatabase(local: boolean) {
  if (local) {
    console.log('🗄️  Using local SQLite database (file:local.db)\n');
    const client = createClient({ url: 'file:local.db' });
    return drizzle(client);
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error(
      'TURSO_DATABASE_URL is required (use --local for local.db)'
    );
  }

  console.log('🗄️  Using Turso database\n');
  const client = createClient({
    url: tursoUrl,
    ...(tursoToken && { authToken: tursoToken }),
  });
  return drizzle(client);
}

type MigrationItem = {
  frameId: string;
  bucket: StorageBucket;
  column: 'thumbnailPath' | 'videoPath';
  oldPath: string;
  newPath: string;
  ulid: string;
  extension: string;
};

type MigrationResult = {
  item: MigrationItem;
  success: boolean;
  error?: string;
};

const OLD_THUMBNAIL_PATTERN = /\/thumbnail\.(jpg|jpeg|png|webp|gif)$/i;
const OLD_VIDEO_PATTERN = /\/motion\.(mp4|webm|mov)$/i;

function getExtensionFromPath(path: string): string {
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || 'jpg';
}

function needsMigration(path: string): boolean {
  return OLD_THUMBNAIL_PATTERN.test(path) || OLD_VIDEO_PATTERN.test(path);
}

function generateNewPath(oldPath: string): {
  newPath: string;
  ulid: string;
  extension: string;
} {
  const extension = getExtensionFromPath(oldPath);
  const ulid = generateId();

  // Replace the filename but keep the directory structure
  // e.g., teams/abc/sequences/def/frames/ghi/thumbnail.jpg
  //    -> teams/abc/sequences/def/frames/ghi/01HXYZ123.jpg
  const newPath = oldPath.replace(/\/[^/]+$/, `/${ulid}.${extension}`);

  return { newPath, ulid, extension };
}

async function findFramesToMigrate(
  db: ReturnType<typeof drizzle>
): Promise<MigrationItem[]> {
  const items: MigrationItem[] = [];

  // Get all frames with thumbnailPath or videoPath
  const allFrames = await db
    .select({
      id: frames.id,
      thumbnailPath: frames.thumbnailPath,
      videoPath: frames.videoPath,
    })
    .from(frames)
    .where(or(isNotNull(frames.thumbnailPath), isNotNull(frames.videoPath)));

  for (const frame of allFrames) {
    // Check thumbnail
    if (frame.thumbnailPath && needsMigration(frame.thumbnailPath)) {
      const { newPath, ulid, extension } = generateNewPath(frame.thumbnailPath);
      items.push({
        frameId: frame.id,
        bucket: STORAGE_BUCKETS.THUMBNAILS,
        column: 'thumbnailPath',
        oldPath: frame.thumbnailPath,
        newPath,
        ulid,
        extension,
      });
    }

    // Check video
    if (frame.videoPath && needsMigration(frame.videoPath)) {
      const { newPath, ulid, extension } = generateNewPath(frame.videoPath);
      items.push({
        frameId: frame.id,
        bucket: STORAGE_BUCKETS.VIDEOS,
        column: 'videoPath',
        oldPath: frame.videoPath,
        newPath,
        ulid,
        extension,
      });
    }
  }

  return items;
}

async function migrateItem(
  db: ReturnType<typeof drizzle>,
  item: MigrationItem
): Promise<MigrationResult> {
  try {
    // Check if source file exists
    const exists = await fileExists(item.bucket, item.oldPath);
    if (!exists) {
      return {
        item,
        success: false,
        error: `Source file does not exist: ${item.oldPath}`,
      };
    }

    // Copy file to new path
    await copyFile(item.bucket, item.oldPath, item.newPath);

    // Update database
    await db
      .update(frames)
      .set({ [item.column]: item.newPath })
      .where(eq(frames.id, item.frameId));

    return { item, success: true };
  } catch (error) {
    return {
      item,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function cleanupOldFiles(items: MigrationItem[]): Promise<void> {
  console.log('\n🧹 Cleaning up old files...\n');

  for (const item of items) {
    try {
      // Verify new file exists before deleting old one
      const newExists = await fileExists(item.bucket, item.newPath);
      if (!newExists) {
        console.log(
          `  ⚠️  Skipping cleanup - new file not found: ${item.newPath}`
        );
        continue;
      }

      await deleteFile(item.bucket, item.oldPath);
      console.log(`  ✓ Deleted: ${item.oldPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ✗ Failed to delete: ${item.oldPath} - ${message}`);
    }
  }
}

async function main() {
  const { local, execute, cleanup } = parseArgs();

  console.log(
    '🔍 R2 Storage Migration: thumbnail.jpg/motion.mp4 → ULID-based names\n'
  );

  const db = createDatabase(local);

  // Find items to migrate
  console.log('Scanning database for files to migrate...\n');
  const items = await findFramesToMigrate(db);

  if (items.length === 0) {
    console.log(
      '✅ No files need migration. All files already use ULID-based names.'
    );
    process.exit(0);
  }

  // Summary
  const thumbnailCount = items.filter(
    (i) => i.column === 'thumbnailPath'
  ).length;
  const videoCount = items.filter((i) => i.column === 'videoPath').length;

  console.log(`Found ${items.length} files to migrate:`);
  console.log(`  • ${thumbnailCount} thumbnails`);
  console.log(`  • ${videoCount} videos\n`);

  // Show sample items
  console.log('Sample migrations:');
  items.slice(0, 5).forEach((item) => {
    console.log(`  ${item.bucket}/${item.oldPath}`);
    console.log(`  → ${item.bucket}/${item.newPath}\n`);
  });

  if (!execute) {
    console.log('─'.repeat(60));
    console.log('DRY RUN - No changes made.');
    console.log('Run with --execute to perform the migration.');
    console.log('─'.repeat(60));

    // Save migration plan to JSON
    const planPath = 'scripts/migration-plan.json';
    writeFileSync(
      planPath,
      JSON.stringify({ items, createdAt: new Date().toISOString() }, null, 2)
    );
    console.log(`\nMigration plan saved to: ${planPath}`);
    process.exit(0);
  }

  // Execute migration
  console.log('─'.repeat(60));
  console.log('EXECUTING MIGRATION...');
  console.log('─'.repeat(60) + '\n');

  const results: MigrationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(
      `\r[${i + 1}/${items.length}] Migrating ${item.bucket}/${item.oldPath.split('/').pop()}...`
    );

    const result = await migrateItem(db, item);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      console.log(`\n  ✗ Failed: ${result.error}`);
    }
  }

  console.log('\n\n' + '─'.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('─'.repeat(60));
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed:  ${failCount}`);

  // Save results for rollback
  const resultsPath = 'scripts/migration-results.json';
  writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        results,
        summary: {
          total: items.length,
          success: successCount,
          failed: failCount,
        },
        completedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`\nResults saved to: ${resultsPath}`);

  // Cleanup old files if requested
  if (cleanup && successCount > 0) {
    const successfulItems = results.filter((r) => r.success).map((r) => r.item);
    await cleanupOldFiles(successfulItems);
  } else if (successCount > 0) {
    console.log(
      '\n💡 Old files preserved. Run with --cleanup to delete them after verification.'
    );
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
