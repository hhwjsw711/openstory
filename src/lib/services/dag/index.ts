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
  createEntity,
  getContentHash,
  getEntity,
  getHistory,
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
export { getProvenance, recordGeneration } from './generation-provenance';

// Lazy invalidation + staleness checks
export {
  broadcastLifecycleChange,
  checkStaleness,
  clearStaleMarkers,
  needsRegeneration,
  onEntityUpdate,
} from './invalidation';

// Entity lifecycle state machine
export { createLifecycleTracker, sendEvent } from './entity-lifecycle';
export type { LifecycleTracker } from './entity-lifecycle';

// Workflow snapshots
export {
  getWorkflowSnapshot,
  handleWorkflowComplete,
  markWorkflowFailed,
  startWorkflow,
} from './workflow-snapshot';

// Collaborative editing
export {
  applyTransaction,
  applyTransactionBatch,
} from './collaborative-transaction';
export type { Transaction } from './collaborative-transaction';
