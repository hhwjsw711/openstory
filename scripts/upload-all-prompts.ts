/**
 * Upload ALL prompts to Langfuse
 *
 * Sources everything from workflow-prompts.ts (single source of truth).
 *
 * Usage: bun scripts/upload-all-prompts.ts
 *
 * Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY (and optionally LANGFUSE_BASE_URL)
 * to be set in .env.local or environment.
 */

import { LangfuseClient } from '@langfuse/client';
import {
  WORKFLOW_CHAT_PROMPTS,
  WORKFLOW_TEXT_PROMPTS,
} from '../src/lib/prompts/workflow-prompts';

// ── Upload logic ──────────────────────────────────────────────────────

async function main() {
  const langfuse = new LangfuseClient();

  const textNames = Object.keys(WORKFLOW_TEXT_PROMPTS);
  const chatNames = Object.keys(WORKFLOW_CHAT_PROMPTS);
  const total = textNames.length + chatNames.length;

  console.log(
    `Uploading ${total} prompts (${textNames.length} text + ${chatNames.length} chat)\n`
  );

  let success = 0;
  let failed = 0;

  // Upload text prompts
  for (const name of textNames) {
    try {
      await langfuse.prompt.create({
        name,
        type: 'text',
        prompt: WORKFLOW_TEXT_PROMPTS[name],
        labels: ['production'],
      });
      console.log(`  [text] ${name}`);
      success++;
    } catch (error) {
      console.error(
        `  [FAIL] ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
      failed++;
    }
  }

  // Upload chat prompts
  for (const name of chatNames) {
    try {
      await langfuse.prompt.create({
        name,
        type: 'chat',
        prompt: WORKFLOW_CHAT_PROMPTS[name],
        labels: ['production'],
      });
      console.log(`  [chat] ${name}`);
      success++;
    } catch (error) {
      console.error(
        `  [FAIL] ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
      failed++;
    }
  }

  console.log(`\nDone: ${success} uploaded, ${failed} failed (${total} total)`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    'Upload failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
