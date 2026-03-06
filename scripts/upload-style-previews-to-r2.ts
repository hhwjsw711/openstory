#!/usr/bin/env bun
/**
 * Upload Style Preview Images to R2 Public Bucket
 *
 * Interactive script that:
 * 1. Reads existing images from preview/
 * 2. Processes to 512x512 (preview) and 256x256 (thumbnail) WebP
 * 3. Lets you choose which scene becomes each style's thumbnail
 * 4. Uploads to R2 public bucket (environment-specific)
 *
 * Usage:
 *   bun scripts/upload-style-previews-to-r2.ts              # Upload (interactive)
 *   bun scripts/upload-style-previews-to-r2.ts --dry-run    # Preview only, no uploads
 */

import * as p from '@clack/prompts';
import { $ } from 'bun';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';

const PREVIEW_DIR = path.join(process.cwd(), 'preview');
const TEMP_DIR = path.join(process.cwd(), '.tmp/r2-upload');
const PREVIEW_SIZE = 512;
const THUMBNAIL_SIZE = 256;

const isDryRun = process.argv.includes('--dry-run');

// Environment-specific configuration
const ENV_CONFIG = {
  prd: {
    bucket: process.env.R2_PUBLIC_ASSETS_BUCKET || 'public-assets',
    url: `https://${process.env.R2_PUBLIC_ASSETS_DOMAIN || 'assets.example.com'}`,
  },
  stg: {
    bucket: process.env.R2_PUBLIC_ASSETS_BUCKET || 'public-assets-stg',
    url: `https://${process.env.R2_PUBLIC_ASSETS_DOMAIN || 'assets.example.com'}`,
  },
};

type Environment = keyof typeof ENV_CONFIG;

type ImageInfo = {
  styleName: string;
  sanitizedName: string;
  sceneName: string;
  localPath: string;
};

/**
 * Process image to target size as WebP
 */
async function processImage(
  inputPath: string,
  targetSize: number
): Promise<Buffer> {
  const imageData = await readFile(inputPath);
  const inputBytes = new Uint8Array(imageData);
  const inputImage = PhotonImage.new_from_byteslice(inputBytes);

  try {
    const resized = resize(
      inputImage,
      targetSize,
      targetSize,
      SamplingFilter.Lanczos3
    );

    try {
      const outputBytes = resized.get_bytes_webp();
      return Buffer.from(outputBytes);
    } finally {
      resized.free();
    }
  } finally {
    inputImage.free();
  }
}

/**
 * Scan the preview/ directory and collect all images
 */
async function scanStyleImages(): Promise<ImageInfo[]> {
  const images: ImageInfo[] = [];

  try {
    const styleDirectories = await readdir(PREVIEW_DIR, {
      withFileTypes: true,
    });

    for (const dir of styleDirectories) {
      if (!dir.isDirectory()) continue;

      const sanitizedName = dir.name;
      const stylePath = path.join(PREVIEW_DIR, sanitizedName);
      const files = await readdir(stylePath);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.webp', '.jpg', '.jpeg'].includes(ext)) continue;

        const sceneName = path.basename(file, ext);
        const localPath = path.join(stylePath, file);

        images.push({
          styleName: sanitizedName
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          sanitizedName,
          sceneName,
          localPath,
        });
      }
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      p.log.error(`Directory not found: ${PREVIEW_DIR}`);
      p.log.info(
        'Run generate-style-previews.ts first to create preview images.'
      );
      process.exit(1);
    }
    throw error;
  }

  return images;
}

/**
 * Upload a buffer to R2 using wrangler CLI
 */
async function uploadToR2(
  buffer: Buffer,
  r2Key: string,
  bucket: string
): Promise<void> {
  const tempFile = path.join(TEMP_DIR, r2Key.replace(/\//g, '-'));
  await mkdir(path.dirname(tempFile), { recursive: true });
  await writeFile(tempFile, buffer);

  const fullKey = `${bucket}/${r2Key}`;
  try {
    await $`bunx wrangler r2 object put ${fullKey} --file=${tempFile} --remote`.quiet();
  } catch (error) {
    throw new Error(
      `Failed to upload ${r2Key}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Upload all images to a single environment
 */
async function uploadToEnvironment(
  env: Environment,
  images: ImageInfo[],
  thumbnailMap: Map<string, string>
): Promise<{ success: number; failed: number }> {
  const config = ENV_CONFIG[env];
  let success = 0;
  let failed = 0;

  // Group images by style
  const styleGroups = new Map<string, ImageInfo[]>();
  for (const img of images) {
    const group = styleGroups.get(img.sanitizedName) || [];
    group.push(img);
    styleGroups.set(img.sanitizedName, group);
  }

  const spinner = p.spinner();
  spinner.start(`Uploading to ${env.toUpperCase()} (${config.bucket})`);

  for (const [styleName, styleImages] of styleGroups) {
    const thumbnailScene = thumbnailMap.get(styleName) || 'character';

    for (const img of styleImages) {
      try {
        // Upload 512px preview
        const previewBuffer = await processImage(img.localPath, PREVIEW_SIZE);
        const previewKey = `styles/${img.sanitizedName}/${img.sceneName}.webp`;
        await uploadToR2(previewBuffer, previewKey, config.bucket);
        success++;

        // Upload 256px thumbnail if this is the chosen scene
        if (img.sceneName === thumbnailScene) {
          const thumbBuffer = await processImage(img.localPath, THUMBNAIL_SIZE);
          const thumbKey = `styles/${img.sanitizedName}/thumbnail.webp`;
          await uploadToR2(thumbBuffer, thumbKey, config.bucket);
          success++;
        }
      } catch (error) {
        p.log.error(
          `Failed: ${img.sanitizedName}/${img.sceneName} — ${error instanceof Error ? error.message : String(error)}`
        );
        failed++;
      }
    }

    spinner.message(`Uploading to ${env.toUpperCase()} — ${styleName} done`);
  }

  spinner.stop(
    `Uploaded to ${env.toUpperCase()}: ${success} files, ${failed} failed`
  );
  return { success, failed };
}

async function main() {
  p.intro('Style Preview Upload to R2');

  // Scan for images
  const images = await scanStyleImages();
  const styleNames = [...new Set(images.map((i) => i.sanitizedName))];
  const sceneNames = [...new Set(images.map((i) => i.sceneName))];

  if (images.length === 0) {
    p.log.warn('No images found in preview/');
    p.outro('Nothing to upload.');
    return;
  }

  p.log.info(
    `Found ${images.length} images across ${styleNames.length} styles`
  );

  // 1. Choose environment
  const env = await p.select({
    message: 'Which environment to upload to?',
    options: [
      {
        value: 'stg' as const,
        label: 'Staging',
        hint: 'public-assets-stg bucket',
      },
      {
        value: 'prd' as const,
        label: 'Production',
        hint: 'public-assets bucket',
      },
      { value: 'both' as const, label: 'Both', hint: 'staging + production' },
    ],
  });

  if (p.isCancel(env)) {
    p.cancel('Upload cancelled.');
    process.exit(0);
  }

  // 2. Choose thumbnail scene
  const sceneOptions = sceneNames.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
    hint:
      s === 'character'
        ? 'close-up portrait'
        : s === 'environment'
          ? 'wide establishing shot'
          : s === 'action'
            ? 'dynamic scene'
            : undefined,
  }));

  const defaultScene = await p.select({
    message: 'Which scene image for style selector thumbnails?',
    options: [
      ...sceneOptions,
      {
        value: 'per-style' as const,
        label: 'Choose per style',
        hint: 'pick individually',
      },
    ],
  });

  if (p.isCancel(defaultScene)) {
    p.cancel('Upload cancelled.');
    process.exit(0);
  }

  // Build thumbnail map
  const thumbnailMap = new Map<string, string>();

  if (defaultScene === 'per-style') {
    for (const styleName of styleNames) {
      const displayName = styleName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      const styleScenes = images
        .filter((i) => i.sanitizedName === styleName)
        .map((i) => i.sceneName);

      const scene = await p.select({
        message: `Thumbnail for "${displayName}"?`,
        options: styleScenes.map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        })),
      });

      if (p.isCancel(scene)) {
        p.cancel('Upload cancelled.');
        process.exit(0);
      }

      thumbnailMap.set(styleName, scene);
    }
  } else {
    for (const styleName of styleNames) {
      thumbnailMap.set(styleName, defaultScene);
    }
  }

  // 3. Show summary
  const environments: Environment[] = env === 'both' ? ['stg', 'prd'] : [env];
  const envLabels = environments
    .map((e) => `${e.toUpperCase()} (${ENV_CONFIG[e].bucket})`)
    .join(', ');

  const thumbnailSummary =
    defaultScene === 'per-style'
      ? [...thumbnailMap.entries()]
          .map(([style, scene]) => `  ${style}: ${scene}`)
          .join('\n')
      : `  All styles: ${defaultScene}`;

  p.note(
    [
      `Environment: ${envLabels}`,
      `Styles: ${styleNames.length}`,
      `Scene images: ${images.length} (${PREVIEW_SIZE}px)`,
      `Thumbnails: ${styleNames.length} (${THUMBNAIL_SIZE}px)`,
      `Total files: ${images.length + styleNames.length} per environment`,
      '',
      'Thumbnail scenes:',
      thumbnailSummary,
    ].join('\n'),
    'Upload Summary'
  );

  if (isDryRun) {
    p.log.warn('Dry run — no uploads will be made.');
    p.log.info('Run without --dry-run to upload.');

    const sampleStyle = styleNames[0];
    const sampleEnv = ENV_CONFIG[environments[0]];
    p.log.info(
      `Sample URL: ${sampleEnv.url}/styles/${sampleStyle}/thumbnail.webp`
    );

    p.outro('Dry run complete.');
    return;
  }

  // 4. Confirm
  const confirmed = await p.confirm({
    message: 'Proceed with upload?',
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Upload cancelled.');
    process.exit(0);
  }

  // 5. Create temp directory and upload
  await mkdir(TEMP_DIR, { recursive: true });

  for (const e of environments) {
    await uploadToEnvironment(e, images, thumbnailMap);
  }

  p.outro('Upload complete!');
}

main().catch((error) => {
  p.log.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
