/**
 * Entity Lifecycle State Machine
 * XState v5 state machine defining the lifecycle of every versioned entity.
 *
 * States: valid → checking → stale → queued → regenerating → valid
 * With failure paths and "edit during generation" handling.
 *
 * @module lib/services/dag/entity-lifecycle
 */

import { setup, createActor, type AnyActorRef } from 'xstate';
import { updateLifecycleState } from './versioned-entity-store';
import { broadcastLifecycleChange } from './invalidation';
import type { LifecycleState } from '@/lib/db/schema/entity-versions';

/**
 * UI state exposed to frontend components.
 */
export type EntityUIState = {
  entityId: string;
  lifecycleState: 'valid' | 'stale' | 'queued' | 'regenerating';
  generatedFromVersion: number;
  currentSourceVersion: number;
  hasPendingChanges: boolean;
  generationProgress?: number;
};

type LifecycleContext = {
  entityId: string;
  branch: string;
  retryCount: number;
  maxRetries: number;
  staleDuringGeneration: boolean;
  generationProgress: number;
};

type LifecycleEvent =
  | { type: 'DEPENDENCY_CHANGED' }
  | { type: 'CHECK_STALENESS' }
  | { type: 'CONFIRMED_STALE' }
  | { type: 'CONFIRMED_VALID' }
  | { type: 'ENQUEUE' }
  | { type: 'START_GENERATION' }
  | { type: 'GENERATION_PROGRESS'; progress: number }
  | { type: 'GENERATION_COMPLETE' }
  | { type: 'GENERATION_FAILED'; error: string }
  | { type: 'RETRY' }
  | { type: 'MARK_DELETED' };

/**
 * Entity lifecycle state machine definition.
 *
 * Flow:
 *   valid → checking → stale → queued → regenerating → valid
 *                  ↘ valid (if not actually stale)
 *                                          ↘ failed → queued (retry)
 *
 * Special case: DEPENDENCY_CHANGED during regenerating sets staleDuringGeneration flag.
 * On completion, the entity transitions to stale instead of valid.
 */
export const entityLifecycleMachine = setup({
  types: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- XState v5 requires this pattern for type inference
    context: {} as LifecycleContext,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- XState v5 requires this pattern for type inference
    events: {} as LifecycleEvent,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- XState v5 requires this pattern for type inference
    input: {} as { entityId: string; branch?: string },
  },
  actions: {
    persistState: ({ context }, params: { state: LifecycleState }) => {
      // Fire-and-forget: persist lifecycle state to database
      void updateLifecycleState(context.entityId, params.state, context.branch);
      void broadcastLifecycleChange(context.entityId, params.state);
    },
    markStaleDuringGeneration: ({ context }) => {
      context.staleDuringGeneration = true;
    },
    incrementRetry: ({ context }) => {
      context.retryCount += 1;
    },
    resetRetry: ({ context }) => {
      context.retryCount = 0;
      context.staleDuringGeneration = false;
    },
    updateProgress: ({ context }, params: { progress: number }) => {
      context.generationProgress = params.progress;
    },
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    wasStaleDuringGeneration: ({ context }) => context.staleDuringGeneration,
  },
}).createMachine({
  id: 'entityLifecycle',
  initial: 'valid',
  context: ({ input }: { input: { entityId: string; branch?: string } }) => ({
    entityId: input.entityId,
    branch: input.branch ?? 'main',
    retryCount: 0,
    maxRetries: 3,
    staleDuringGeneration: false,
    generationProgress: 0,
  }),
  states: {
    valid: {
      entry: [
        { type: 'resetRetry' },
        { type: 'persistState', params: { state: 'valid' as const } },
      ],
      on: {
        DEPENDENCY_CHANGED: { target: 'checking' },
        MARK_DELETED: { target: 'deleted' },
      },
    },

    checking: {
      entry: [{ type: 'persistState', params: { state: 'checking' as const } }],
      on: {
        CONFIRMED_STALE: { target: 'stale' },
        CONFIRMED_VALID: { target: 'valid' },
        DEPENDENCY_CHANGED: { target: 'checking' },
      },
    },

    stale: {
      entry: [{ type: 'persistState', params: { state: 'stale' as const } }],
      on: {
        ENQUEUE: { target: 'queued' },
        DEPENDENCY_CHANGED: { target: 'stale' },
        MARK_DELETED: { target: 'deleted' },
      },
    },

    queued: {
      entry: [{ type: 'persistState', params: { state: 'queued' as const } }],
      on: {
        START_GENERATION: { target: 'regenerating' },
        DEPENDENCY_CHANGED: { target: 'stale' },
        MARK_DELETED: { target: 'deleted' },
      },
    },

    regenerating: {
      entry: [
        { type: 'persistState', params: { state: 'regenerating' as const } },
      ],
      on: {
        GENERATION_PROGRESS: {
          actions: [
            {
              type: 'updateProgress',
              params: ({ event }) => ({ progress: event.progress }),
            },
          ],
        },
        GENERATION_COMPLETE: [
          {
            guard: 'wasStaleDuringGeneration',
            target: 'stale',
          },
          {
            target: 'valid',
          },
        ],
        GENERATION_FAILED: [
          {
            guard: 'canRetry',
            target: 'failed',
          },
          {
            target: 'stale',
          },
        ],
        DEPENDENCY_CHANGED: {
          actions: [{ type: 'markStaleDuringGeneration' }],
        },
        MARK_DELETED: { target: 'deleted' },
      },
    },

    failed: {
      entry: [
        { type: 'incrementRetry' },
        { type: 'persistState', params: { state: 'failed' as const } },
      ],
      on: {
        RETRY: { target: 'queued' },
        DEPENDENCY_CHANGED: { target: 'stale' },
        MARK_DELETED: { target: 'deleted' },
      },
    },

    deleted: {
      entry: [{ type: 'persistState', params: { state: 'deleted' as const } }],
      type: 'final',
    },
  },
});

/**
 * Create and start a lifecycle actor for an entity.
 *
 * @param entityId - Entity identifier
 * @param branch - Branch name (default: 'main')
 * @param initialState - Optional initial state to restore from DB
 * @returns The running XState actor
 */
export function createLifecycleActor(
  entityId: string,
  branch = 'main',
  _initialState?: LifecycleState
): AnyActorRef {
  const actor = createActor(entityLifecycleMachine, {
    input: { entityId, branch },
  });
  actor.start();
  return actor;
}

/**
 * Map XState state to simplified UI state.
 */
export function toUILifecycleState(
  state: string
): EntityUIState['lifecycleState'] {
  switch (state) {
    case 'valid':
      return 'valid';
    case 'checking':
    case 'stale':
    case 'failed':
      return 'stale';
    case 'queued':
      return 'queued';
    case 'regenerating':
      return 'regenerating';
    default:
      return 'valid';
  }
}
