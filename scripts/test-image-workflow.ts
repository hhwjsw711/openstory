#!/usr/bin/env bun
/**
 * CLI script to trigger the image generation workflow
 *
 * Usage:
 *   bun scripts/test-image-workflow.ts "A cat wearing sunglasses"
 *   bun scripts/test-image-workflow.ts --model flux_1_1_ultra "A sunset over mountains"
 *
 * Prerequisites:
 *   - bun qstash:dev running
 *   - bun dev running
 */

import { Client } from '@upstash/workflow';

const prompt =
  process.argv.find(
    (arg) =>
      !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]
  ) ?? 'A golden retriever in a park';

const modelIndex = process.argv.indexOf('--model');
const model = modelIndex !== -1 ? process.argv[modelIndex + 1] : undefined;

console.log('Triggering image workflow...');
console.log(`  Prompt: ${prompt}`);
if (model) console.log(`  Model: ${model}`);

const baseUrl = process.env.UPSTASH_WORKFLOW_URL ?? 'https://local.velro.ai';

// Use Client directly - triggerWorkflow requires TanStack Start server context
const client = new Client({ token: process.env.QSTASH_TOKEN });
console.log(client);
const result = await client.trigger({
  url: `${baseUrl}/api/workflows/image`,
  body: { prompt, ...(model && { model }) },
  // Bypass localtunnel interstitial page
  headers: baseUrl.includes('loca.lt')
    ? { 'bypass-tunnel-reminder': 'true' }
    : undefined,
});

console.log(`Workflow started: ${result.workflowRunId}`);
