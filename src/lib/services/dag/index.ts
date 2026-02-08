/**
 * DAG Dependency System
 * Central export for the versioned entity dependency tracking system.
 *
 * @module lib/services/dag
 */

// Content hashing
export { computeContentHash, computeInputHash } from './content-hash';

// Versioned entity CRUD
export {
  branchEntity,
  createEntity,
  getContentHash,
  getEntity,
  getHistory,
  restoreEntity,
  updateEntity,
  updateLifecycleState,
} from './versioned-entity-store';
export type { VersionedEntity } from './versioned-entity-store';

// Dependency graph
export {
  addDependency,
  computeEntityInputHash,
  getDependencies,
  getDependents,
  getRegenerationOrder,
  getTransitiveDependencies,
  removeDependency,
} from './dependency-graph';

// Generation provenance
export {
  getProvenance,
  needsRegeneration,
  recordGeneration,
} from './generation-provenance';

// Lazy invalidation
export {
  broadcastLifecycleChange,
  checkStaleness,
  clearStaleMarkers,
  onEntityUpdate,
} from './invalidation';

// Entity lifecycle state machine
export {
  createLifecycleActor,
  entityLifecycleMachine,
  toUILifecycleState,
} from './entity-lifecycle';
export type { EntityUIState } from './entity-lifecycle';

// Workflow snapshots
export {
  getWorkflowSnapshot,
  handleWorkflowComplete,
  markWorkflowFailed,
  startWorkflow,
} from './workflow-snapshot';

// Generation queue
export {
  claimNext,
  completeJob,
  enqueue,
  enqueueBatch,
  failJob,
  getQueueStatus,
} from './generation-queue';

// Collaborative editing
export {
  applyTransaction,
  applyTransactionBatch,
} from './collaborative-transaction';
export type { Transaction } from './collaborative-transaction';

// Realtime sync
export {
  cleanupWorkflowProgress,
  getRealtimeSyncHub,
  getWorkflowProgress,
  publishEntityChanged,
  publishLifecycleChanged,
  publishWorkflowProgress,
  RealtimeSyncHub,
} from './realtime-sync';
