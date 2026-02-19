/**
 * Live workflow status lookup via QStash.
 *
 * Replaces DB-stored status fields with direct QStash queries.
 * Workflow run IDs are deterministic (e.g. `image-${frameId}`)
 * so we can construct them from frame/sequence IDs without storing them.
 */

import { getWorkflowClient } from './client';

// Workflow types used in deduplication IDs
export const FRAME_WORKFLOW_TYPES = ['image', 'motion', 'variant'] as const;
export type FrameWorkflowType = (typeof FRAME_WORKFLOW_TYPES)[number];

export const SEQUENCE_WORKFLOW_TYPES = [
  'storyboard',
  'merge',
  'music',
] as const;
export type SequenceWorkflowType = (typeof SEQUENCE_WORKFLOW_TYPES)[number];

export type WorkflowRunState =
  | 'RUN_STARTED'
  | 'RUN_SUCCESS'
  | 'RUN_FAILED'
  | 'RUN_CANCELED';

/** Status for all workflow types on a single frame */
export type FrameWorkflowStatuses = Partial<
  Record<FrameWorkflowType, WorkflowRunState>
>;

/**
 * Build the deterministic workflow run ID that QStash stores.
 * QStash prefixes with `wfr_` internally.
 */
export function buildWorkflowRunId(type: string, entityId: string): string {
  return `wfr_${type}-${entityId}`;
}

/**
 * Parse a QStash workflow run ID back into type and entity ID.
 * e.g. `wfr_image-abc123` → { type: 'image', entityId: 'abc123' }
 */
export function parseWorkflowRunId(
  runId: string
): { type: string; entityId: string } | null {
  const withoutPrefix = runId.startsWith('wfr_') ? runId.slice(4) : runId;
  const firstDash = withoutPrefix.indexOf('-');
  if (firstDash === -1) return null;
  return {
    type: withoutPrefix.substring(0, firstDash),
    entityId: withoutPrefix.substring(firstDash + 1),
  };
}

function isFrameWorkflowType(type: string): type is FrameWorkflowType {
  return (FRAME_WORKFLOW_TYPES as readonly string[]).includes(type);
}

function isSequenceWorkflowType(type: string): type is SequenceWorkflowType {
  return (SEQUENCE_WORKFLOW_TYPES as readonly string[]).includes(type);
}

/**
 * Query QStash for all currently active (RUN_STARTED) workflows,
 * filtered to the given frame IDs.
 *
 * Returns a map of frameId → { image?, motion?, variant? } with their states.
 * Only frames with active workflows appear in the result.
 */
export async function getActiveWorkflowsForFrames(
  frameIds: string[]
): Promise<Record<string, FrameWorkflowStatuses>> {
  if (frameIds.length === 0) return {};

  const client = getWorkflowClient();

  // Single API call to get all active workflows
  const { runs } = await client.logs({ state: 'RUN_STARTED', count: 200 });

  const frameIdSet = new Set(frameIds);
  const result: Record<string, FrameWorkflowStatuses> = {};

  for (const run of runs) {
    const parsed = parseWorkflowRunId(run.workflowRunId);
    if (!parsed) continue;
    if (!frameIdSet.has(parsed.entityId)) continue;

    if (!isFrameWorkflowType(parsed.type)) continue;
    const type = parsed.type;

    if (!result[parsed.entityId]) {
      result[parsed.entityId] = {};
    }
    result[parsed.entityId][type] = run.workflowState;
  }

  return result;
}

/**
 * Query QStash for active sequence-level workflows.
 */
export async function getActiveWorkflowsForSequence(
  sequenceId: string
): Promise<Partial<Record<SequenceWorkflowType, WorkflowRunState>>> {
  const client = getWorkflowClient();
  const { runs } = await client.logs({ state: 'RUN_STARTED', count: 200 });

  const result: Partial<Record<SequenceWorkflowType, WorkflowRunState>> = {};

  for (const run of runs) {
    const parsed = parseWorkflowRunId(run.workflowRunId);
    if (!parsed) continue;
    if (parsed.entityId !== sequenceId) continue;

    if (!isSequenceWorkflowType(parsed.type)) continue;
    const type = parsed.type;

    result[type] = run.workflowState;
  }

  return result;
}
