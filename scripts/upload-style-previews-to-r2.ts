#!/usr/bin/env bun
/**
 * Upload Style Preview Images to R2 Public Bucket
 *
 * This script:
 * 1. Reads existing images from /public/assets/styles/
 * 2. Downsamples them to 512x512 square
 * 3. Uploads to R2 public bucket (environment-specific)
 * 4. Images are accessible at: https://storage[-env].velro.ai/styles/{style-name}/{scene-name}.jpg
 *
 * Database URLs are handled by the seed script using deterministic URLs.
 *
 * Usage:
 *   bun scripts/upload-style-previews-to-r2.ts                    # Dry run (dev)
 *   bun scripts/upload-style-previews-to-r2.ts --env stg          # Dry run (staging)
 *   bun scripts/upload-style-previews-to-r2.ts --env prd          # Dry run (production)
 *   bun scripts/upload-style-previews-to-r2.ts --env stg --execute # Upload to staging
 *   bun scripts/upload-style-previews-to-r2.ts --env prd --execute # Upload to production
 */

import { $ } from 'bun';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public/assets/styles');
const TEMP_DIR = path.join(process.cwd(), '.tmp/r2-upload');
const TARGET_SIZE = 512; // 512x512 square
const JPEG_QUALITY = 85; // 85% quality for good balance of size/quality

// Parse command line arguments
const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

// Get environment from --env flag (prd, stg, or default to dev)
const envIndex = process.argv.indexOf('--env');
const environment = envIndex !== -1 ? process.argv[envIndex + 1] : 'dev';

if (!['prd', 'stg', 'dev'].includes(environment)) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.error('   Valid options: prd, stg, dev');
  process.exit(1);
}

// Environment-specific configuration
const ENV_CONFIG = {
  prd: {
    bucket: 'velro-public-assets',
    url: 'https://assets.velro.ai',
  },
  stg: {
    bucket: 'velro-public-assets-stg',
    url: 'https://assets-stg.velro.ai',
  },
};

const R2_PUBLIC_BUCKET =
  ENV_CONFIG[environment as keyof typeof ENV_CONFIG].bucket;
const R2_PUBLIC_URL = ENV_CONFIG[environment as keyof typeof ENV_CONFIG].url;

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No uploads will be made');
  console.log(`   Environment: ${environment.toUpperCase()}`);
  console.log(`   Bucket: ${R2_PUBLIC_BUCKET}`);
  console.log(`   URL: ${R2_PUBLIC_URL}`);
  console.log('   Run with --execute to actually upload to public R2 bucket\n');
} else {
  console.log(`📦 Environment: ${environment.toUpperCase()}`);
  console.log(`🪣 Bucket: ${R2_PUBLIC_BUCKET}`);
  console.log(`🔗 Public URL: ${R2_PUBLIC_URL}\n`);
}

type ImageInfo = {
  styleName: string;
  sanitizedName: string;
  sceneName: string;
  localPath: string;
  r2Path: string;
};

/**
 * Downsample image to 512x512 using Bun's native image APIs
 * Returns a Buffer of the resized JPEG
 */
async function downsampleImage(inputPath: string): Promise<Buffer> {
  // Read the original image
  const imageData = await readFile(inputPath);

  // Use sharp for image processing (need to install it)
  // For now, let's use a simpler approach with Bun's built-in APIs
  // Note: Bun doesn't have built-in image resizing yet, so we'll need sharp

  try {
    // Try to import sharp dynamically
    const sharp = await import('sharp');

    const resized = await sharp
      .default(imageData)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    return resized;
  } catch {
    console.error('❌ Sharp not installed. Install it with: bun add sharp');
    console.error('   Falling back to using original image without resizing.');
    return Buffer.from(imageData);
  }
}

/**
 * Scan the public/assets/styles directory and collect all images
 */
async function scanStyleImages(): Promise<ImageInfo[]> {
  const images: ImageInfo[] = [];

  try {
    const styleDirectories = await readdir(PUBLIC_ASSETS_DIR, {
      withFileTypes: true,
    });

    for (const dir of styleDirectories) {
      if (!dir.isDirectory()) continue;

      const sanitizedName = dir.name;
      const stylePath = path.join(PUBLIC_ASSETS_DIR, sanitizedName);

      // Read scene images
      const files = await readdir(stylePath);

      for (const file of files) {
        if (!file.endsWith('.jpg') && !file.endsWith('.jpeg')) continue;

        const sceneName = path.basename(file, path.extname(file));
        const localPath = path.join(stylePath, file);
        const r2Path = `styles/${sanitizedName}/${sceneName}.jpg`;

        images.push({
          styleName: sanitizedName
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          sanitizedName,
          sceneName,
          localPath,
          r2Path,
        });
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`❌ Directory not found: ${PUBLIC_ASSETS_DIR}`);
      console.error(
        '   Make sure style preview images exist in /public/assets/styles/'
      );
      process.exit(1);
    }
    throw error;
  }

  return images;
}

/**
 * Upload a single image to R2 public bucket using wrangler CLI
 */
async function uploadImage(image: ImageInfo): Promise<string> {
  // Downsample the image
  const resizedBuffer = await downsampleImage(image.localPath);

  // Write to temp file
  const tempFile = path.join(
    TEMP_DIR,
    `${image.sanitizedName}-${image.sceneName}.jpg`
  );
  await writeFile(tempFile, resizedBuffer);

  // Upload using wrangler CLI (--remote flag uploads to actual R2, not local)
  const r2Key = `${R2_PUBLIC_BUCKET}/${image.r2Path}`;

  try {
    await $`bunx wrangler r2 object put ${r2Key} --file=${tempFile} --remote`.quiet();
  } catch (error) {
    throw new Error(
      `Failed to upload ${image.r2Path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Return deterministic public URL
  const publicUrl = `${R2_PUBLIC_URL}/${image.r2Path}`;
  return publicUrl;
}

/**
 * Generate deterministic public URL for an image
 */
function getPublicUrl(styleName: string, sceneName: string): string {
  return `${R2_PUBLIC_URL}/styles/${styleName}/${sceneName}.jpg`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 Style Preview Migration to R2\n');

  // Create temp directory for processed images
  await mkdir(TEMP_DIR, { recursive: true });

  // Scan for images
  console.log('📂 Scanning for style images...');
  const images = await scanStyleImages();
  console.log(
    `   Found ${images.length} images in ${new Set(images.map((i) => i.sanitizedName)).size} styles\n`
  );

  if (images.length === 0) {
    console.log('✅ No images to process');
    return;
  }

  // Display what will be processed
  console.log('📋 Images to process:');
  const styleGroups = images.reduce(
    (acc, img) => {
      if (!acc[img.sanitizedName]) acc[img.sanitizedName] = [];
      acc[img.sanitizedName].push(img.sceneName);
      return acc;
    },
    {} as Record<string, string[]>
  );

  for (const [style, scenes] of Object.entries(styleGroups)) {
    console.log(`   ${style}: ${scenes.join(', ')}`);
  }
  console.log();

  if (isDryRun) {
    console.log(
      '💡 This was a dry run. Run with --execute to upload to public R2 bucket.'
    );
    console.log('\n📋 Sample URLs that will be generated:');
    const sampleStyle = images[0];
    if (sampleStyle) {
      console.log(
        `   ${getPublicUrl(sampleStyle.sanitizedName, sampleStyle.sceneName)}`
      );
    }
    return;
  }

  // Execute the upload
  console.log(`⬆️  Uploading images to public R2 bucket: ${R2_PUBLIC_BUCKET}\n`);
  let successCount = 0;
  let failCount = 0;

  for (const image of images) {
    try {
      console.log(
        `   Uploading ${image.sanitizedName}/${image.sceneName}.jpg...`
      );
      const publicUrl = await uploadImage(image);
      console.log(`      → ${publicUrl}`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to upload ${image.r2Path}:`, error);
      failCount++;
    }
  }

  console.log(
    `\n✅ Upload complete: ${successCount} succeeded, ${failCount} failed\n`
  );

  console.log('🎉 Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Update seed script to use deterministic URLs:');
  console.log(
    `      previewUrl: '${R2_PUBLIC_URL}/styles/\${sanitizedName}/character.jpg'`
  );
  console.log('   2. Test image display in the app');
  console.log('   3. Delete /public/assets/styles/ to reduce bundle size');
}

main().catch((error) => {
  console.error('❌ Error during migration:', error);
  process.exit(1);
});
