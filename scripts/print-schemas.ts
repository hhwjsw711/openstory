/**
 * Print JSON schemas for all structured output Zod schemas
 * Run with: bun scripts/print-schemas.ts
 * Outputs to: scripts/schemas/*.json
 *
 * Validates:
 * - Required field coverage for strict JSON schema
 * - Description coverage for AI structured outputs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// Import canonical schemas from the codebase
import {
  characterBibleEntrySchema,
  continuitySchema,
  motionPromptSchema,
  projectMetadataSchema,
  sceneAnalysisSchema,
  sceneSchema,
  visualPromptSchema,
} from '@/lib/ai/scene-analysis.schema';

const SCHEMA_OUTPUT_DIR = join(import.meta.dir, 'schemas');

// Phase 1: Scene Splitting Schema (mirrors scene-splitting.ts)
const sceneSplittingResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status' }),
  projectMetadata: projectMetadataSchema.meta({
    description: 'Project-level metadata extracted from script',
  }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
          sceneNumber: true,
          originalScript: true,
          metadata: true,
        })
        .required()
    )
    .meta({ description: 'Array of scenes split from the script' }),
});

// Phase 2: Character Extraction Schema (mirrors character-extraction.ts)
const characterExtractionResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status' }),
  characterBible: z
    .array(characterBibleEntrySchema)
    .catch([])
    .meta({ description: 'Character descriptions' }),
});

// Phase 3: Visual Prompt Schema (mirrors visual-prompts.ts)
const visualPromptGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
        })
        .required()
        .extend({
          prompts: z
            .object({
              visual: visualPromptSchema.meta({
                description: 'Image generation prompt data',
              }),
            })
            .meta({ description: 'Visual generation prompts for this scene' }),
          continuity: continuitySchema
            .catch({ characterTags: [] })
            .meta({ description: 'Continuity tracking for scene consistency' }),
        })
    )
    .meta({ description: 'Array of scenes with visual prompts' }),
});

// Phase 4: Motion Prompt Schema (mirrors motion-prompts.ts)
const motionPromptGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
        })
        .required()
        .extend({
          prompts: z
            .object({
              motion: motionPromptSchema.meta({
                description: 'Motion/video generation prompt data',
              }),
            })
            .meta({ description: 'Motion generation prompts for this scene' }),
        })
    )
    .meta({ description: 'Array of scenes with motion prompts' }),
});

// Phase 5: Audio Design Schema (mirrors audio-design.ts)
const audioDesignGenerationResultSchema = z.object({
  status: z
    .enum(['success', 'error', 'rejected'])
    .catch('success')
    .meta({ description: 'Processing status' }),
  scenes: z
    .array(
      sceneSchema
        .pick({
          sceneId: true,
          audioDesign: true,
        })
        .required()
    )
    .meta({ description: 'Array of scenes with audio design' }),
});

// Helper to print schema and write to file
async function printSchema(name: string, schema: z.ZodTypeAny) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SCHEMA: ${name}`);
  console.log('='.repeat(80));

  const jsonSchema = z.toJSONSchema(schema);
  console.log(JSON.stringify(jsonSchema, null, 2));

  // Write to file
  const filePath = join(SCHEMA_OUTPUT_DIR, `${name}.json`);
  await writeFile(filePath, JSON.stringify(jsonSchema, null, 2));
  console.log(`\n📁 Written to: ${filePath}`);

  // Check for properties without required
  checkRequiredFields(jsonSchema, name);

  // Check for missing descriptions
  console.log('\n📝 Checking descriptions:');
  const missingDescriptions = checkDescriptions(jsonSchema, name);
  if (missingDescriptions === 0) {
    console.log('   ✅ All properties have descriptions');
  } else {
    console.log(`   ❌ ${missingDescriptions} properties missing descriptions`);
  }
}

function checkRequiredFields(schema: unknown, path: string) {
  if (typeof schema !== 'object' || schema === null) return;

  const obj = schema as Record<string, unknown>;

  if (obj.type === 'object' && obj.properties) {
    const properties = obj.properties as Record<string, unknown>;
    const required = Array.isArray(obj.required)
      ? obj.required.filter((r): r is string => typeof r === 'string')
      : [];
    const propertyNames = Object.keys(properties);
    const missing = propertyNames.filter((p) => !required.includes(p));

    if (missing.length > 0) {
      console.log(`\n⚠️  WARNING at ${path}:`);
      console.log(`   Properties not in 'required': ${missing.join(', ')}`);
      console.log(`   This will fail strict JSON schema validation!`);
    }

    // Recurse into properties
    for (const [key, value] of Object.entries(properties)) {
      checkRequiredFields(value, `${path}.${key}`);
    }
  }

  if (obj.items) {
    checkRequiredFields(obj.items, `${path}[]`);
  }
}

/**
 * Check for missing descriptions in JSON schema properties.
 * Descriptions help AI models understand the expected data format.
 */
function checkDescriptions(schema: unknown, path: string): number {
  let missingCount = 0;

  if (typeof schema !== 'object' || schema === null) return missingCount;

  const obj = schema as Record<string, unknown>;

  if (obj.type === 'object' && obj.properties) {
    const properties = obj.properties as Record<
      string,
      Record<string, unknown>
    >;

    for (const [key, value] of Object.entries(properties)) {
      if (!value.description) {
        console.log(`   ⚠️  Missing description: ${path}.${key}`);
        missingCount++;
      }
      missingCount += checkDescriptions(value, `${path}.${key}`);
    }
  }

  if (obj.items) {
    missingCount += checkDescriptions(obj.items, `${path}[]`);
  }

  return missingCount;
}

// Main
async function main() {
  console.log(
    '\n🔍 Analyzing Zod schemas for structured output compatibility...\n'
  );

  // Create output directory
  await mkdir(SCHEMA_OUTPUT_DIR, { recursive: true });

  // Print all phase schemas
  await printSchema('phase-1-scene-splitting', sceneSplittingResultSchema);
  await printSchema(
    'phase-2-character-extraction',
    characterExtractionResultSchema
  );
  await printSchema(
    'phase-3-visual-prompts',
    visualPromptGenerationResultSchema
  );
  await printSchema(
    'phase-4-motion-prompts',
    motionPromptGenerationResultSchema
  );
  await printSchema('phase-5-audio-design', audioDesignGenerationResultSchema);

  // Print canonical schema for reference
  await printSchema('canonical-scene-analysis', sceneAnalysisSchema);

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
For strict JSON schema validation (Azure/OpenRouter/GPT-mini), ALL properties
in an object must be listed in the 'required' array.

Zod modifiers that cause issues:
  - .optional()  → property not in 'required' (GPT-mini fails)
  - .nullish()   → property not in 'required'

Safe alternatives:
  - .catch(defaultValue)  → property IS in 'required', has default
  - .nullable().catch(null) → property IS in 'required', allows null

For AI structured outputs, use .meta({ description: '...' }) on all fields
to help the model understand the expected data format.

Schema files written to: ${SCHEMA_OUTPUT_DIR}/
`);
}

main().catch(console.error);
