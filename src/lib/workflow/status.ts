/**
 * Workflow run ID utilities.
 *
 * Deterministic run IDs let us look up QStash workflow state
 * from just a frame/sequence ID — no need to store the run ID in the DB.
 */

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
