#!/usr/bin/env bun
/**
 * CLI script to trigger sequence-level music generation
 *
 * Usage:
 *   bun scripts/trigger-music.ts --sequence-id <id> --user-id <id> --team-id <id> [options]
 *
 * Required:
 *   --sequence-id    Sequence to generate music for
 *   --user-id        User ID for auth context
 *   --team-id        Team ID for auth context
 *
 * Options:
 *   --prompt         Custom music prompt (default: auto-built from frame metadata)
 *   --duration       Duration in seconds (default: auto-summed from frames)
 *   --tags           Comma-separated genre tags
 *
 * Example:
 *   bun scripts/trigger-music.ts \
 *     --sequence-id 01J... \
 *     --user-id 01J... \
 *     --team-id 01J... \
 *     --prompt "cinematic, orchestral, epic" \
 *     --duration 60
 */

import { parseArgs } from 'util';
import { triggerWorkflow } from '../src/lib/workflow/client';
import type { MusicWorkflowInput } from '../src/lib/workflow/types';

function printUsage() {
  console.log(`
Usage:
  bun scripts/trigger-music.ts --sequence-id <id> --user-id <id> --team-id <id> [options]

Required:
  --sequence-id    Sequence to generate music for
  --user-id        User ID for auth context
  --team-id        Team ID for auth context

Options:
  --prompt         Custom music prompt (default: "cinematic background music")
  --duration       Duration in seconds (default: 30)
  --tags           Comma-separated genre tags (default: "cinematic")
`);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'sequence-id': { type: 'string' },
      'user-id': { type: 'string' },
      'team-id': { type: 'string' },
      prompt: { type: 'string' },
      duration: { type: 'string' },
      tags: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const sequenceId = values['sequence-id'];
  const userId = values['user-id'];
  const teamId = values['team-id'];

  if (!sequenceId || !userId || !teamId) {
    console.error(
      'Error: --sequence-id, --user-id, and --team-id are required'
    );
    printUsage();
    process.exit(1);
  }

  const prompt = values.prompt || 'cinematic background music';
  const duration = values.duration ? parseInt(values.duration, 10) : 30;
  const tags = values.tags || 'cinematic';

  const musicInput: MusicWorkflowInput = {
    userId,
    teamId,
    sequenceId,
    prompt,
    tags,
    duration,
  };

  console.log('Triggering music workflow with:', musicInput);

  const workflowRunId = await triggerWorkflow('/music', musicInput, {
    deduplicationId: `music-${sequenceId}`,
  });

  console.log(`Music workflow triggered successfully!`);
  console.log(`  Workflow Run ID: ${workflowRunId}`);
  console.log(`  Sequence: ${sequenceId}`);
  console.log(`  Prompt: ${prompt}`);
  console.log(`  Duration: ${duration}s`);
}

main().catch((error) => {
  console.error('Failed to trigger music workflow:', error);
  process.exit(1);
});
