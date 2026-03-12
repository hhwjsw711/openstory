/**
 * Workflow type and state definitions.
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
