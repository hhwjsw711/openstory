#!/usr/bin/env bun
/**
 * Upload E2E Traces to R2
 *
 * Uploads Playwright trace.zip files to R2 for easy debugging.
 * Traces can be viewed at: https://trace.playwright.dev/?trace=<url>
 *
 * Usage (CI):
 *   bun scripts/upload-e2e-traces.ts
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_STORAGE_DOMAIN, GITHUB_RUN_ID
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const RESULTS_DIR = path.join(process.cwd(), 'e2e/results');
const TRACE_VIEWER_URL = 'https://trace.playwright.dev/?trace=';

type TraceFile = {
  name: string;
  localPath: string;
  r2Key: string;
  publicUrl: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createR2Client(): S3Client {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Recursively find all trace.zip files in directory
 */
async function findTraceFiles(dir: string): Promise<string[]> {
  const traces: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const nested = await findTraceFiles(fullPath);
        traces.push(...nested);
      } else if (entry.name === 'trace.zip') {
        traces.push(fullPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return traces;
}

/**
 * Extract a readable test name from the trace path
 * e.g., "test-results/auth-spec-ts-login-test-chromium/trace.zip" -> "auth-login-test"
 */
function getTestNameFromPath(tracePath: string): string {
  const relativePath = path.relative(RESULTS_DIR, tracePath);
  const parts = relativePath.split(path.sep);

  // Get the directory name (e.g., "auth-spec-ts-login-test-chromium")
  const testDir = parts[parts.length - 2] || 'unknown';

  // Clean up: remove "-chromium", "-spec-ts", simplify
  return testDir
    .replace(/-chromium$/, '')
    .replace(/-spec-ts-/, '-')
    .replace(/-retry\d+$/, '');
}

async function main() {
  console.log('Uploading E2E traces to R2...\n');

  // Find all trace files
  const tracePaths = await findTraceFiles(RESULTS_DIR);

  if (tracePaths.length === 0) {
    console.log('No trace files found in', RESULTS_DIR);
    return;
  }

  console.log(`Found ${tracePaths.length} trace file(s)\n`);

  // Prepare upload info
  const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
  const bucketName = getRequiredEnv('R2_BUCKET_NAME');
  const publicDomain = getRequiredEnv('R2_PUBLIC_STORAGE_DOMAIN');

  const traces: TraceFile[] = tracePaths.map((localPath) => {
    const testName = getTestNameFromPath(localPath);
    const r2Key = `e2e-reports/${runId}/${testName}.zip`;
    const publicUrl = `https://${publicDomain}/${r2Key}`;

    return { name: testName, localPath, r2Key, publicUrl };
  });

  // Upload each trace
  const client = createR2Client();
  const uploaded: TraceFile[] = [];

  for (const trace of traces) {
    try {
      console.log(`Uploading ${trace.name}...`);

      const fileContent = await readFile(trace.localPath);

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: trace.r2Key,
          Body: fileContent,
          ContentType: 'application/zip',
          CacheControl: 'public, max-age=2592000', // 30 days
        })
      );

      uploaded.push(trace);
      console.log(`  -> ${trace.publicUrl}`);
    } catch (error) {
      console.error(
        `  Failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Output summary with trace viewer links
  if (uploaded.length > 0) {
    console.log(`\nUploaded ${uploaded.length} trace(s) to R2\n`);
    console.log('View traces:');

    for (const trace of uploaded) {
      const viewerUrl = `${TRACE_VIEWER_URL}${encodeURIComponent(trace.publicUrl)}`;
      console.log(`  - ${trace.name}: ${viewerUrl}`);
    }

    // Write to GitHub Actions step summary if available
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      const summaryContent = [
        '## E2E Test Traces',
        '',
        `Uploaded ${uploaded.length} trace file(s) for debugging:`,
        '',
        ...uploaded.map((t) => {
          const viewerUrl = `${TRACE_VIEWER_URL}${encodeURIComponent(t.publicUrl)}`;
          return `- **${t.name}**: [View Trace](${viewerUrl})`;
        }),
        '',
      ].join('\n');

      await appendFile(summaryPath, summaryContent);
      console.log('\nTrace links added to GitHub Actions summary');
    }
  }
}

main().catch((error) => {
  console.error('Error uploading traces:', error);
  process.exit(1);
});
