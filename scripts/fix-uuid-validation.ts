#!/usr/bin/env bun
/**
 * Script to replace UUID validation with ULID validation in API routes
 * Replaces z.string().uuid() with proper ulidSchema imports and usage
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const files = [
  'src/app/api/styles/[styleId]/route.ts',
  'src/app/api/sequences/[sequenceId]/motion/route.ts',
  'src/app/api/sequences/[sequenceId]/frames/[frameId]/route.ts',
  'src/app/api/frames/[frameId]/download/route.ts',
  'src/app/api/sequences/[sequenceId]/frames/[frameId]/motion/route.ts',
  'src/app/api/sequences/[sequenceId]/chapters.vtt/route.ts',
  'src/app/api/sequences/[sequenceId]/frames/generate/route.ts',
  'src/app/api/sequences/[sequenceId]/frames/[frameId]/regenerate/route.ts',
  'src/app/api/user/teams/check/route.ts',
  'src/app/api/sequences/[sequenceId]/frames/reorder/route.ts',
  'src/app/api/teams/[teamId]/members/[userId]/role/route.ts',
  'src/app/api/teams/[teamId]/members/[userId]/route.ts',
  'src/app/api/teams/[teamId]/members/route.ts',
  'src/app/api/teams/[teamId]/invite/route.ts',
  'src/app/api/fal/usage/route.ts',
];

const projectRoot = resolve(process.cwd());

for (const file of files) {
  const filePath = resolve(projectRoot, file);
  console.log(`Processing: ${file}`);

  try {
    let content = readFileSync(filePath, 'utf-8');

    // Check if file needs ulidSchema import
    const needsUlidImport = content.includes('z.string().uuid()');

    if (!needsUlidImport) {
      console.log(`  ✓ Already fixed or no UUID validation found`);
      continue;
    }

    // Add ulidSchema import if not present
    if (!content.includes("from '@/lib/schemas/id.schemas'")) {
      // Find the last import statement
      const importRegex = /^import .+ from .+;$/gm;
      const imports = content.match(importRegex);

      if (imports) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;

        content =
          content.slice(0, insertPosition) +
          "\nimport { ulidSchema } from '@/lib/schemas/id.schemas';" +
          content.slice(insertPosition);
      }
    }

    // Replace UUID validation pattern with ULID validation
    // Pattern 1: const uuidSchema = z.string().uuid(); ... uuidSchema.parse()
    content = content.replace(
      /(\s*)\/\/ Validate UUID\s*\n\s*const uuidSchema = z\.string\(\)\.uuid\(\);\s*\n\s*try \{\s*\n\s*uuidSchema\.parse\((\w+)\);\s*\n\s*\} catch \{/g,
      '$1// Validate ULID\n$1try {\n$1  ulidSchema.parse($2);\n$1} catch {'
    );

    // Pattern 2: Direct z.string().uuid().parse()
    content = content.replace(
      /z\.string\(\)\.uuid\(\)\.parse\(([^)]+)\)/g,
      'ulidSchema.parse($1)'
    );

    // Remove unused z import if only used for uuid
    if (!content.match(/\bz\.[a-z]/)) {
      content = content.replace(/import \{ z \} from 'zod';\n/g, '');
      content = content.replace(/import type \{ z \} from 'zod';\n/g, '');
    }

    writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ Fixed`);
  } catch (error) {
    console.error(`  ✗ Error:`, error);
  }
}

console.log('\nDone! Fixed UUID validation in all API routes.');
