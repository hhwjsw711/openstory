#!/usr/bin/env bun
/**
 * Migration script to copy files from Supabase Storage to Cloudflare R2
 *
 * Usage:
 *   bun scripts/migrate-supabase-to-r2.ts --bucket thumbnails
 *   bun scripts/migrate-supabase-to-r2.ts --bucket videos
 *   bun scripts/migrate-supabase-to-r2.ts --all
 *   bun scripts/migrate-supabase-to-r2.ts --all --dry-run  # Preview without migrating
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  uploadFile,
  STORAGE_BUCKETS,
  type StorageBucket,
} from '@/lib/db/helpers/storage';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allBuckets = args.includes('--all');
const bucketIndex = args.indexOf('--bucket');
const specificBucket = bucketIndex !== -1 ? args[bucketIndex + 1] : null;

type MigrationStats = {
  bucket: string;
  totalFiles: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  totalBytes: number;
  errors: Array<{ file: string; error: string }>;
};

/**
 * Migrate files from a Supabase Storage bucket to R2
 */
async function migrateBucket(bucket: StorageBucket): Promise<MigrationStats> {
  const stats: MigrationStats = {
    bucket,
    totalFiles: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    totalBytes: 0,
    errors: [],
  };

  console.log(`\n📦 Migrating bucket: ${bucket}`);
  console.log(
    `${dryRun ? '🔍 DRY RUN MODE - No files will be migrated\n' : ''}`
  );

  try {
    const supabase = createAdminClient();

    // List all files in the Supabase bucket
    console.log(`📋 Listing files in ${bucket}...`);
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      console.log(`ℹ️  No files found in ${bucket}`);
      return stats;
    }

    stats.totalFiles = files.length;
    console.log(`Found ${files.length} files\n`);

    // Migrate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;

      try {
        console.log(
          `[${i + 1}/${files.length}] ${dryRun ? 'Would migrate' : 'Migrating'}: ${fileName}`
        );

        if (dryRun) {
          stats.skippedCount++;
          stats.totalBytes += file.metadata?.size || 0;
          continue;
        }

        // Download file from Supabase
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(fileName);

        if (downloadError) {
          throw new Error(`Download failed: ${downloadError.message}`);
        }

        if (!fileData) {
          throw new Error('No data returned from download');
        }

        // Determine content type
        const contentType =
          fileData.type || getContentTypeFromFileName(fileName);

        // Upload to R2
        await uploadFile(bucket, fileName, fileData, {
          contentType,
          upsert: true,
        });

        stats.successCount++;
        stats.totalBytes += file.metadata?.size || 0;
        console.log(`  ✅ Success`);
      } catch (error) {
        stats.failureCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({ file: fileName, error: errorMessage });
        console.error(`  ❌ Failed: ${errorMessage}`);
      }
    }
  } catch (error) {
    console.error(`\n❌ Migration failed for ${bucket}:`, error);
    throw error;
  }

  return stats;
}

/**
 * Get content type from file extension
 */
function getContentTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Print migration summary
 */
function printSummary(allStats: MigrationStats[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));

  const totals = allStats.reduce(
    (acc, stats) => ({
      totalFiles: acc.totalFiles + stats.totalFiles,
      successCount: acc.successCount + stats.successCount,
      failureCount: acc.failureCount + stats.failureCount,
      skippedCount: acc.skippedCount + stats.skippedCount,
      totalBytes: acc.totalBytes + stats.totalBytes,
      errorCount: acc.errorCount + stats.errors.length,
    }),
    {
      totalFiles: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      totalBytes: 0,
      errorCount: 0,
    }
  );

  // Per-bucket stats
  for (const stats of allStats) {
    console.log(`\n📦 ${stats.bucket}:`);
    console.log(`   Total files: ${stats.totalFiles}`);
    if (dryRun) {
      console.log(`   Would migrate: ${stats.skippedCount}`);
    } else {
      console.log(`   ✅ Successful: ${stats.successCount}`);
      console.log(`   ❌ Failed: ${stats.failureCount}`);
    }
    console.log(
      `   Total size: ${(stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`
    );
  }

  // Overall totals
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📈 OVERALL:`);
  console.log(`   Total files: ${totals.totalFiles}`);
  if (dryRun) {
    console.log(`   Would migrate: ${totals.skippedCount}`);
  } else {
    console.log(`   ✅ Successful: ${totals.successCount}`);
    console.log(`   ❌ Failed: ${totals.failureCount}`);
  }
  console.log(
    `   Total size: ${(totals.totalBytes / (1024 * 1024)).toFixed(2)} MB`
  );

  // Print errors if any
  if (totals.errorCount > 0 && !dryRun) {
    console.log(`\n❌ ERRORS (${totals.errorCount}):`);
    for (const stats of allStats) {
      if (stats.errors.length > 0) {
        console.log(`\n${stats.bucket}:`);
        for (const error of stats.errors) {
          console.log(`   • ${error.file}: ${error.error}`);
        }
      }
    }
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Supabase Storage → R2 Migration Script\n');

  // Validate arguments
  if (!allBuckets && !specificBucket) {
    console.error('❌ Error: Specify --all or --bucket <bucket-name>');
    console.error('\nUsage:');
    console.error(
      '  bun scripts/migrate-supabase-to-r2.ts --bucket thumbnails'
    );
    console.error('  bun scripts/migrate-supabase-to-r2.ts --all');
    console.error('  bun scripts/migrate-supabase-to-r2.ts --all --dry-run');
    process.exit(1);
  }

  // Determine which buckets to migrate
  const bucketsToMigrate: StorageBucket[] = allBuckets
    ? Object.values(STORAGE_BUCKETS)
    : specificBucket
      ? [specificBucket as StorageBucket]
      : [];

  if (bucketsToMigrate.length === 0) {
    console.error('❌ Error: No valid buckets to migrate');
    process.exit(1);
  }

  console.log(`📋 Buckets to migrate: ${bucketsToMigrate.join(', ')}`);
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode - no files will be migrated');
  }

  // Migrate each bucket
  const allStats: MigrationStats[] = [];
  for (const bucket of bucketsToMigrate) {
    const stats = await migrateBucket(bucket);
    allStats.push(stats);
  }

  // Print summary
  printSummary(allStats);

  // Exit with error if any failures
  const hasFailures = allStats.some((s) => s.failureCount > 0);
  if (hasFailures && !dryRun) {
    console.error(
      '⚠️  Migration completed with errors. See summary above for details.\n'
    );
    process.exit(1);
  }

  console.log(
    `✅ Migration ${dryRun ? 'preview' : ''} completed successfully!\n`
  );
}

// Run the migration
main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
