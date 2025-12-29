/**
 * Print JSON schemas for all structured output Zod schemas
 * Run with: bun scripts/print-schemas.ts
 * Outputs to: scripts/schemas/*.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// Import the schemas from scene-splitting
import { aspectRatioSchema } from '@/lib/constants/aspect-ratios';

const SCHEMA_OUTPUT_DIR = join(import.meta.dir, 'schemas');

// Re-define schemas here to avoid import issues and see exactly what's being used

// Scene Splitting Schema
const sceneSplittingResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  projectMetadata: z.object({
    title: z.string().catch('Untitled'),
    aspectRatio: aspectRatioSchema.catch('16:9'),
    generatedAt: z.string().catch(''),
  }),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      sceneNumber: z.number(),
      originalScript: z.object({
        extract: z.string().catch(''),
        dialogue: z
          .array(
            z.object({
              character: z.string().nullable().catch(null),
              line: z.string().catch(''),
            })
          )
          .catch([]),
      }),
      metadata: z.object({
        title: z.string().catch('Untitled Scene'),
        durationSeconds: z.number().catch(3),
        location: z.string().catch(''),
        timeOfDay: z.string().catch(''),
        storyBeat: z.string().catch(''),
      }),
    })
  ),
});

// Character Extraction Schema
const characterBibleEntrySchema = z.object({
  characterId: z.string(),
  name: z.string(),
  age: z.union([z.number(), z.string()]).nullish(),
  gender: z.string().optional(),
  ethnicity: z.string().optional(),
  physicalDescription: z.string().catch(''),
  standardClothing: z.string().catch(''),
  distinguishingFeatures: z.string().optional(),
  consistencyTag: z.string().catch(''),
});

const characterExtractionResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  characterBible: z.array(characterBibleEntrySchema).catch([]),
});

// Visual Prompt Schema
const visualPromptComponentsSchema = z.object({
  sceneDescription: z.string().catch(''),
  subject: z.string().catch(''),
  environment: z.string().catch(''),
  lighting: z.string().catch(''),
  camera: z.string().catch(''),
  composition: z.string().catch(''),
  style: z.string().catch(''),
  technical: z.string().catch(''),
  atmosphere: z.string().catch(''),
});

const visualPromptSchema = z.object({
  fullPrompt: z.string().min(1),
  negativePrompt: z.string().catch(''),
  components: visualPromptComponentsSchema,
});

const cameraAngleVariantSchema = z.object({
  id: z.enum(['A1', 'A2', 'A3']).catch('A1'),
  angle: z.string().catch(''),
  description: z.string().catch(''),
  effect: z.string().catch(''),
});

const moodTreatmentVariantSchema = z.object({
  id: z.enum(['C1', 'C2', 'C3']).catch('C1'),
  mood: z.string().catch(''),
  lighting: z.string().catch(''),
  colorPalette: z.string().catch(''),
  effect: z.string().catch(''),
});

const continuitySchema = z.object({
  characterTags: z.array(z.string()).catch([]),
  environmentTag: z.string().catch(''),
  colorPalette: z.string().catch(''),
  lightingSetup: z.string().catch(''),
});

const visualPromptGenerationResultSchema = z.object({
  status: z.enum(['success', 'error', 'rejected']).catch('success'),
  scenes: z.array(
    z.object({
      sceneId: z.string(),
      variants: z
        .object({
          cameraAngles: z
            .array(cameraAngleVariantSchema)
            .min(1)
            .max(5)
            .catch([]),
          moodTreatments: z
            .array(moodTreatmentVariantSchema)
            .min(1)
            .max(5)
            .catch([]),
        })
        .optional(),
      selectedVariant: z
        .object({
          cameraAngle: z.enum(['A1', 'A2', 'A3']).catch('A1'),
          moodTreatment: z.enum(['C1', 'C2', 'C3']).catch('C1'),
          rationale: z.string().optional(),
        })
        .optional(),
      prompts: z.object({
        visual: visualPromptSchema,
      }),
      continuity: continuitySchema.optional(),
    })
  ),
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
}

function checkRequiredFields(schema: unknown, path: string) {
  if (typeof schema !== 'object' || schema === null) return;

  const obj = schema as Record<string, unknown>;

  if (obj.type === 'object' && obj.properties) {
    const properties = obj.properties as Record<string, unknown>;
    const required = (obj.required as string[]) || [];
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

// Main
async function main() {
  console.log(
    '\n🔍 Analyzing Zod schemas for structured output compatibility...\n'
  );

  // Create output directory
  await mkdir(SCHEMA_OUTPUT_DIR, { recursive: true });

  await printSchema('phase-1-scene-splitting', sceneSplittingResultSchema);
  await printSchema(
    'phase-2-character-extraction',
    characterExtractionResultSchema
  );
  await printSchema(
    'phase-3-visual-prompts',
    visualPromptGenerationResultSchema
  );

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
For strict JSON schema validation (Azure/OpenRouter), ALL properties
in an object must be listed in the 'required' array.

Zod modifiers that cause issues:
  - .optional()  → property not in 'required'
  - .nullish()   → property not in 'required'

Safe alternatives:
  - .catch(defaultValue)  → property IS in 'required', has default
  - .nullable().catch(null) → property IS in 'required', allows null

Schema files written to: ${SCHEMA_OUTPUT_DIR}/
`);
}

main().catch(console.error);
