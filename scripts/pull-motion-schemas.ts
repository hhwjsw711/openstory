/**
 * Fetch video model schemas from fal.ai OpenAPI endpoint
 *
 * Usage: bun scripts/pull-motion-schemas.ts
 *
 * Fetches the OpenAPI schema for each video model, resolves $ref references,
 * and writes the result to src/lib/motion/motion-schemas.ts.
 *
 * Based on the schema resolution approach from @fal-ai/client.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';

// -- JSON Schema types --------------------------------------------------------

type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  title?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  examples?: unknown[];
  [key: string]: unknown;
};

type OpenAPISchema = {
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: { schemas?: Record<string, JSONSchema> };
};

type OpenAPIOperation = {
  requestBody?: {
    content?: { 'application/json'?: { schema?: JSONSchema } };
  };
  responses?: Record<
    string,
    { content?: { 'application/json'?: { schema?: JSONSchema } } }
  >;
};

type ModelSchema = { input: JSONSchema; output: JSONSchema };

// -- $ref resolution (ported from @fal-ai/client schema.ts) -------------------

const MAX_REF_DEPTH = 10;

function resolveRefs(
  schema: JSONSchema,
  definitions: Record<string, JSONSchema>,
  visited: Set<string> = new Set(),
  depth = 0,
  collectedDefs: Record<string, JSONSchema> = {}
): JSONSchema {
  if (depth > MAX_REF_DEPTH) return schema;

  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    if (visited.has(refPath)) {
      if (!(refPath in collectedDefs) && definitions[refPath]) {
        collectedDefs[refPath] = {};
        collectedDefs[refPath] = resolveRefs(
          { ...definitions[refPath] },
          definitions,
          new Set([refPath]),
          0,
          collectedDefs
        );
      }
      return { $ref: `#/$defs/${refPath}` };
    }

    const refSchema = definitions[refPath];
    if (!refSchema) return schema;

    visited.add(refPath);
    const resolved = resolveRefs(
      { ...refSchema },
      definitions,
      new Set(visited),
      depth + 1,
      collectedDefs
    );
    visited.delete(refPath);
    return resolved;
  }

  const recurse = (value: JSONSchema): JSONSchema =>
    resolveRefs(value, definitions, new Set(visited), depth + 1, collectedDefs);

  const {
    properties,
    items,
    allOf,
    anyOf,
    oneOf,
    additionalProperties,
    ...rest
  } = schema;
  delete rest.$defs;
  const result: JSONSchema = { ...rest };

  if (properties) {
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([k, v]) => [k, recurse(v)])
    );
  }
  if (items) result.items = recurse(items);
  if (allOf) result.allOf = allOf.map(recurse);
  if (anyOf) result.anyOf = anyOf.map(recurse);
  if (oneOf) result.oneOf = oneOf.map(recurse);
  if (
    typeof additionalProperties === 'object' &&
    additionalProperties !== null
  ) {
    result.additionalProperties = recurse(additionalProperties);
  } else if (additionalProperties !== undefined) {
    result.additionalProperties = additionalProperties;
  }

  return result;
}

function resolveSchemaRef(
  schemaRef: JSONSchema,
  definitions: Record<string, JSONSchema>,
  schemaType: 'input' | 'output'
): JSONSchema {
  const collectedDefs: Record<string, JSONSchema> = {};
  let result: JSONSchema;

  if (!schemaRef.$ref) {
    result = resolveRefs(
      { ...schemaRef },
      definitions,
      new Set(),
      0,
      collectedDefs
    );
  } else {
    const refName = schemaRef.$ref.replace('#/components/schemas/', '');
    const refDef = definitions[refName];
    if (!refDef) {
      throw new Error(
        `Could not resolve ${schemaType} schema ref: ${schemaRef.$ref}`
      );
    }
    result = resolveRefs(
      { ...refDef },
      definitions,
      new Set(),
      0,
      collectedDefs
    );
  }

  if (Object.keys(collectedDefs).length > 0) {
    result.$defs = collectedDefs;
  }
  return result;
}

// -- Fetch and extract --------------------------------------------------------

async function fetchModelSchema(endpointId: string): Promise<ModelSchema> {
  const url = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(endpointId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching schema for ${endpointId}`
    );
  }

  const openapi: OpenAPISchema = await response.json();
  const definitions = openapi.components?.schemas ?? {};

  const inputPath = `/${endpointId}`;
  const outputPath = `/${endpointId}/requests/{request_id}`;

  const inputRef =
    openapi.paths[inputPath]?.post?.requestBody?.content?.['application/json']
      ?.schema;
  if (!inputRef) throw new Error(`No input schema found for ${endpointId}`);

  const outputRef =
    openapi.paths[outputPath]?.get?.responses?.['200']?.content?.[
      'application/json'
    ]?.schema;
  if (!outputRef) throw new Error(`No output schema found for ${endpointId}`);

  return {
    input: resolveSchemaRef(inputRef, definitions, 'input'),
    output: resolveSchemaRef(outputRef, definitions, 'output'),
  };
}

// -- Strip noisy fields -------------------------------------------------------

/** Remove examples, x-fal metadata, and vendor-specific fields to keep output concise and type-safe */
function stripNoise(schema: JSONSchema): JSONSchema {
  const result: JSONSchema = {};

  // Only copy known JSONSchema fields, dropping vendor extensions
  const knownKeys = new Set([
    'type',
    'title',
    'description',
    'properties',
    'required',
    'items',
    'anyOf',
    'oneOf',
    'allOf',
    '$ref',
    '$defs',
    'enum',
    'const',
    'default',
    'format',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'maxItems',
    'pattern',
    'additionalProperties',
  ]);

  for (const key of Object.keys(schema)) {
    if (knownKeys.has(key)) {
      (result as Record<string, unknown>)[key] =
        schema[key as keyof JSONSchema];
    }
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([k, v]) => [k, stripNoise(v)])
    );
  }
  if (result.items) result.items = stripNoise(result.items);
  if (result.allOf) result.allOf = result.allOf.map(stripNoise);
  if (result.anyOf) result.anyOf = result.anyOf.map(stripNoise);
  if (result.oneOf) result.oneOf = result.oneOf.map(stripNoise);
  if (
    typeof result.additionalProperties === 'object' &&
    result.additionalProperties !== null
  ) {
    result.additionalProperties = stripNoise(result.additionalProperties);
  }
  if (result.$defs) {
    result.$defs = Object.fromEntries(
      Object.entries(result.$defs).map(([k, v]) => [k, stripNoise(v)])
    );
  }

  return result;
}

// -- Prompt limit overrides ---------------------------------------------------

/** Limits documented in descriptions or enforced by API but missing from schema maxLength */
const PROMPT_LIMIT_OVERRIDES: Record<string, number> = {
  'wan/v2.6/image-to-video/flash': 800,
};

function applyPromptOverrides(
  endpointId: string,
  schema: JSONSchema
): JSONSchema {
  const override = PROMPT_LIMIT_OVERRIDES[endpointId];
  if (!override || !schema.properties?.prompt) return schema;

  const prompt = schema.properties.prompt;
  // Only add if not already set
  if (!prompt.maxLength) {
    schema.properties.prompt = {
      ...prompt,
      maxLength: override,
    };
  }
  return schema;
}

// -- Code generation ----------------------------------------------------------

function toTsValue(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);

  if (value === null || value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => `${innerPad}${toTsValue(v, indent + 1)}`);
    return `[\n${items.join(',\n')},\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${innerPad}${key}: ${toTsValue(v, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')},\n${pad}}`;
  }

  return JSON.stringify(value);
}

function generateTypeScript(schemas: Record<string, ModelSchema>): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Video Model Input/Output Schemas`);
  lines.push(` *`);
  lines.push(` * Auto-generated by: bun scripts/pull-motion-schemas.ts`);
  lines.push(
    ` * Source: https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`
  );
  lines.push(` *`);
  lines.push(` * DO NOT EDIT MANUALLY — re-run the script to refresh.`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`type JSONSchema = {`);
  lines.push(`  type?: string | string[];`);
  lines.push(`  title?: string;`);
  lines.push(`  description?: string;`);
  lines.push(`  properties?: Record<string, JSONSchema>;`);
  lines.push(`  required?: string[];`);
  lines.push(`  items?: JSONSchema;`);
  lines.push(`  anyOf?: JSONSchema[];`);
  lines.push(`  oneOf?: JSONSchema[];`);
  lines.push(`  allOf?: JSONSchema[];`);
  lines.push(`  $ref?: string;`);
  lines.push(`  $defs?: Record<string, JSONSchema>;`);
  lines.push(`  enum?: unknown[];`);
  lines.push(`  const?: unknown;`);
  lines.push(`  default?: unknown;`);
  lines.push(`  format?: string;`);
  lines.push(`  minimum?: number;`);
  lines.push(`  maximum?: number;`);
  lines.push(`  minLength?: number;`);
  lines.push(`  maxLength?: number;`);
  lines.push(`  maxItems?: number;`);
  lines.push(`  pattern?: string;`);
  lines.push(`  additionalProperties?: boolean | JSONSchema;`);
  lines.push(`};`);
  lines.push(``);
  lines.push(`type ModelSchema = {`);
  lines.push(`  input: JSONSchema;`);
  lines.push(`  output: JSONSchema;`);
  lines.push(`};`);
  lines.push(``);
  lines.push(
    `export const MOTION_MODEL_SCHEMAS: Record<string, ModelSchema> = ${toTsValue(schemas, 0)};`
  );
  lines.push(``);
  lines.push(
    `// -- Derived prompt limits ----------------------------------------------------`
  );
  lines.push(``);
  lines.push(
    `/** Prompt character limits by fal.ai endpoint ID. undefined = no limit documented in schema. */`
  );
  lines.push(
    `export const MOTION_PROMPT_LIMITS: Record<string, number | undefined> =`
  );
  lines.push(`  Object.fromEntries(`);
  lines.push(
    `    Object.entries(MOTION_MODEL_SCHEMAS).map(([id, schema]) => {`
  );
  lines.push(`      const promptProp = schema.input.properties?.prompt;`);
  lines.push(`      const maxLength =`);
  lines.push(`        promptProp?.maxLength ??`);
  lines.push(`        promptProp?.anyOf?.find(`);
  lines.push(`          (s): s is JSONSchema & { maxLength: number } =>`);
  lines.push(`            typeof s === 'object' && 'maxLength' in s`);
  lines.push(`        )?.maxLength;`);
  lines.push(`      return [id, maxLength];`);
  lines.push(`    })`);
  lines.push(`  );`);
  lines.push(``);

  return lines.join('\n');
}

// -- Main ---------------------------------------------------------------------

async function main() {
  const endpointIds = [
    ...new Set(Object.values(IMAGE_TO_VIDEO_MODELS).map((m) => m.id)),
  ];

  console.log(`Fetching schemas for ${endpointIds.length} video models...\n`);

  const schemas: Record<string, ModelSchema> = {};

  for (const id of endpointIds) {
    process.stdout.write(`  ${id} ... `);
    const raw = await fetchModelSchema(id);
    const input = applyPromptOverrides(id, stripNoise(raw.input));
    const output = stripNoise(raw.output);
    schemas[id] = { input, output };

    const promptMax =
      input.properties?.prompt?.maxLength ??
      input.properties?.prompt?.anyOf?.find(
        (s: JSONSchema) => typeof s === 'object' && 'maxLength' in s
      )?.maxLength;
    console.log(promptMax ? `maxLength=${promptMax}` : 'no prompt limit');
  }

  const outPath = join(
    import.meta.dir,
    '..',
    'src',
    'lib',
    'motion',
    'motion-schemas.ts'
  );
  const ts = generateTypeScript(schemas);
  await writeFile(outPath, ts);

  console.log(`\nWritten to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
