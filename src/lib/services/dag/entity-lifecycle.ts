/**
 * Entity Lifecycle State Machine
 * Simple state transition validator for entity lifecycle.
 *
 * States: valid → checking → stale → queued → regenerating → valid
 * With failure paths and "edit during generation" handling.
 *
 * @module lib/services/dag/entity-lifecycle
 */

import type { LifecycleState } from '@/lib/db/schema/entity-versions';
import { updateLifecycleState } from './versioned-entity-store';
import { broadcastLifecycleChange } from './invalidation';

type LifecycleEvent =
  | 'DEPENDENCY_CHANGED'
  | 'CONFIRMED_STALE'
  | 'CONFIRMED_VALID'
  | 'ENQUEUE'
  | 'START_GENERATION'
  | 'GENERATION_COMPLETE'
  | 'GENERATION_FAILED'
  | 'RETRY'
  | 'MARK_DELETED';

/** Valid transitions: [currentState][event] → nextState */
const TRANSITIONS: Record<string, Record<string, LifecycleState>> = {
  valid: {
    DEPENDENCY_CHANGED: 'checking',
    MARK_DELETED: 'deleted',
  },
  checking: {
    CONFIRMED_STALE: 'stale',
    CONFIRMED_VALID: 'valid',
    DEPENDENCY_CHANGED: 'checking',
  },
  stale: {
    ENQUEUE: 'queued',
    DEPENDENCY_CHANGED: 'stale',
    MARK_DELETED: 'deleted',
  },
  queued: {
    START_GENERATION: 'regenerating',
    DEPENDENCY_CHANGED: 'stale',
    MARK_DELETED: 'deleted',
  },
  regenerating: {
    GENERATION_COMPLETE: 'valid',
    GENERATION_FAILED: 'failed',
    MARK_DELETED: 'deleted',
  },
  failed: {
    RETRY: 'queued',
    DEPENDENCY_CHANGED: 'stale',
    MARK_DELETED: 'deleted',
  },
  deleted: {},
};

const MAX_RETRIES = 3;

/**
 * In-memory lifecycle tracker for an entity.
 * Validates transitions and persists state changes.
 */
export type LifecycleTracker = {
  readonly entityId: string;
  readonly branch: string;
  state: LifecycleState;
  staleDuringGeneration: boolean;
  retryCount: number;
};

/**
 * Create a lifecycle tracker for an entity.
 */
export function createLifecycleTracker(
  entityId: string,
  branch = 'main',
  initialState: LifecycleState = 'valid'
): LifecycleTracker {
  return {
    entityId,
    branch,
    state: initialState,
    staleDuringGeneration: false,
    retryCount: 0,
  };
}

/**
 * Send an event to transition a lifecycle tracker.
 * Returns the new state, or null if the transition is invalid.
 */
export async function sendEvent(
  tracker: LifecycleTracker,
  event: LifecycleEvent
): Promise<LifecycleState | null> {
  // Special: DEPENDENCY_CHANGED during regeneration sets flag instead of transitioning
  if (tracker.state === 'regenerating' && event === 'DEPENDENCY_CHANGED') {
    tracker.staleDuringGeneration = true;
    return 'regenerating';
  }

  // Special: GENERATION_COMPLETE with staleDuringGeneration goes to stale
  if (
    tracker.state === 'regenerating' &&
    event === 'GENERATION_COMPLETE' &&
    tracker.staleDuringGeneration
  ) {
    tracker.staleDuringGeneration = false;
    tracker.state = 'stale';
    await persistState(tracker);
    return 'stale';
  }

  // Special: GENERATION_FAILED with max retries goes to stale
  if (tracker.state === 'regenerating' && event === 'GENERATION_FAILED') {
    if (tracker.retryCount >= MAX_RETRIES) {
      tracker.state = 'stale';
      await persistState(tracker);
      return 'stale';
    }
    tracker.retryCount += 1;
    tracker.state = 'failed';
    await persistState(tracker);
    return 'failed';
  }

  const transitions = TRANSITIONS[tracker.state];
  const nextState = transitions?.[event];
  if (!nextState) return null;

  // Reset tracking on entering valid
  if (nextState === 'valid') {
    tracker.retryCount = 0;
    tracker.staleDuringGeneration = false;
  }

  tracker.state = nextState;
  await persistState(tracker);
  return nextState;
}

async function persistState(tracker: LifecycleTracker): Promise<void> {
  await Promise.all([
    updateLifecycleState(tracker.entityId, tracker.state, tracker.branch),
    broadcastLifecycleChange(tracker.entityId, tracker.state),
  ]);
}
