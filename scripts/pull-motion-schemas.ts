/**
 * Fetch OpenAPI specs for motion (image-to-video) models from fal.ai
 *
 * Downloads per-endpoint OpenAPI specs for each model in IMAGE_TO_VIDEO_MODELS,
 * saves them as json/fal.models.motion.json in the format expected by
 * @hey-api/openapi-ts, then runs codegen to generate types + Zod schemas.
 *
 * Usage: bun scripts/pull-motion-schemas.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';

type OpenAPISpec = {
  info?: { 'x-fal-metadata'?: { endpointId?: string }; [key: string]: unknown };
  [key: string]: unknown;
};

async function fetchOpenApiSpec(endpointId: string): Promise<OpenAPISpec> {
  const url = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(endpointId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching spec for ${endpointId}`);
  }
  return response.json();
}

async function main() {
  // Deduplicate endpoint IDs (kling_v3_pro and kling_v3_pro_no_audio share one)
  const endpointIds = [
    ...new Set(Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id)),
  ];

  console.log(
    `Fetching OpenAPI specs for ${endpointIds.length} motion models...\n`
  );

  const models = [];

  for (const id of endpointIds) {
    process.stdout.write(`  ${id} ... `);
    const spec = await fetchOpenApiSpec(id);

    // Add endpoint metadata (same format as fetch-openapi-models.ts)
    if (!spec.info) spec.info = {};
    spec.info['x-fal-metadata'] = { endpointId: id };

    models.push({
      endpoint_id: id,
      openapi: spec,
    });
    console.log('ok');
  }

  // Save in the same format fetch-openapi-models.ts uses
  const jsonDir = join(import.meta.dir, '..', 'json');
  mkdirSync(jsonDir, { recursive: true });

  const outputPath = join(jsonDir, 'fal.models.motion.json');
  const data = {
    generated_at: new Date().toISOString(),
    total_models: models.length,
    category: 'motion',
    models,
  };

  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nSaved ${models.length} specs to ${outputPath}`);

  // Run hey-api codegen
  console.log('\nRunning @hey-api/openapi-ts codegen...\n');
  const proc = Bun.spawn(['bunx', '@hey-api/openapi-ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Codegen failed with exit code ${exitCode}`);
  }

  console.log('\nDone! Generated types in src/lib/motion/generated/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
