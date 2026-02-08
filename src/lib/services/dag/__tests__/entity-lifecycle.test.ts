import { describe, expect, it, mock } from 'bun:test';
import { createActor } from 'xstate';

// Mock the side-effect modules that persistState calls
mock.module('../versioned-entity-store', () => ({
  updateLifecycleState: mock().mockResolvedValue(undefined),
  getContentHash: mock().mockResolvedValue('hash'),
  getEntity: mock().mockResolvedValue(null),
  createEntity: mock().mockResolvedValue({}),
  updateEntity: mock().mockResolvedValue({}),
  getHistory: mock().mockResolvedValue([]),
  branchEntity: mock().mockResolvedValue({}),
  restoreEntity: mock().mockResolvedValue({}),
}));

mock.module('../invalidation', () => ({
  broadcastLifecycleChange: mock().mockResolvedValue(undefined),
  onEntityUpdate: mock().mockResolvedValue(undefined),
  checkStaleness: mock().mockResolvedValue({
    isStale: false,
    changedDependencies: [],
  }),
  clearStaleMarkers: mock().mockResolvedValue(undefined),
}));

const { entityLifecycleMachine } = await import('../entity-lifecycle');

describe('Entity Lifecycle State Machine', () => {
  function createTestActor() {
    return createActor(entityLifecycleMachine, {
      input: { entityId: 'test_entity', branch: 'main' },
    });
  }

  describe('initial state', () => {
    it('should start in valid state', () => {
      const actor = createTestActor();
      actor.start();
      expect(actor.getSnapshot().value).toBe('valid');
      actor.stop();
    });
  });

  describe('valid → checking → stale flow', () => {
    it('should transition to checking on DEPENDENCY_CHANGED', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      expect(actor.getSnapshot().value).toBe('checking');

      actor.stop();
    });

    it('should transition to stale on CONFIRMED_STALE', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      expect(actor.getSnapshot().value).toBe('stale');

      actor.stop();
    });

    it('should return to valid on CONFIRMED_VALID', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_VALID' });
      expect(actor.getSnapshot().value).toBe('valid');

      actor.stop();
    });
  });

  describe('stale → queued → regenerating → valid flow', () => {
    it('should complete the full regeneration lifecycle', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      expect(actor.getSnapshot().value).toBe('stale');

      actor.send({ type: 'ENQUEUE' });
      expect(actor.getSnapshot().value).toBe('queued');

      actor.send({ type: 'START_GENERATION' });
      expect(actor.getSnapshot().value).toBe('regenerating');

      actor.send({ type: 'GENERATION_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('valid');

      actor.stop();
    });
  });

  describe('edit during generation', () => {
    it('should transition to stale after generation completes if dependency changed during regeneration', () => {
      const actor = createTestActor();
      actor.start();

      // Get to regenerating state
      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'ENQUEUE' });
      actor.send({ type: 'START_GENERATION' });
      expect(actor.getSnapshot().value).toBe('regenerating');

      // Dependency changes during generation
      actor.send({ type: 'DEPENDENCY_CHANGED' });
      // Should still be regenerating (not interrupted)
      expect(actor.getSnapshot().value).toBe('regenerating');
      expect(actor.getSnapshot().context.staleDuringGeneration).toBe(true);

      // Generation completes — but should go to stale, not valid
      actor.send({ type: 'GENERATION_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('stale');

      actor.stop();
    });
  });

  describe('failure and retry', () => {
    it('should transition to failed on GENERATION_FAILED', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'ENQUEUE' });
      actor.send({ type: 'START_GENERATION' });

      actor.send({ type: 'GENERATION_FAILED', error: 'AI service timeout' });
      expect(actor.getSnapshot().value).toBe('failed');

      actor.stop();
    });

    it('should allow retry from failed state', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'ENQUEUE' });
      actor.send({ type: 'START_GENERATION' });
      actor.send({ type: 'GENERATION_FAILED', error: 'timeout' });
      expect(actor.getSnapshot().value).toBe('failed');

      actor.send({ type: 'RETRY' });
      expect(actor.getSnapshot().value).toBe('queued');

      actor.stop();
    });

    it('should track retry count', () => {
      const actor = createTestActor();
      actor.start();

      // First failure + retry
      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'ENQUEUE' });
      actor.send({ type: 'START_GENERATION' });
      actor.send({ type: 'GENERATION_FAILED', error: 'error 1' });
      expect(actor.getSnapshot().context.retryCount).toBe(1);

      actor.send({ type: 'RETRY' });
      actor.send({ type: 'START_GENERATION' });
      actor.send({ type: 'GENERATION_FAILED', error: 'error 2' });
      expect(actor.getSnapshot().context.retryCount).toBe(2);

      actor.stop();
    });

    it('should go to stale when max retries exceeded', () => {
      const actor = createTestActor();
      actor.start();

      // Exhaust all 3 retries
      for (let i = 0; i < 3; i++) {
        actor.send({ type: 'DEPENDENCY_CHANGED' });
        actor.send({ type: 'CONFIRMED_STALE' });
        actor.send({ type: 'ENQUEUE' });
        actor.send({ type: 'START_GENERATION' });
        actor.send({ type: 'GENERATION_FAILED', error: `error ${i + 1}` });
        if (i < 2) {
          actor.send({ type: 'RETRY' });
        }
      }

      // After 3 failures, retry count is 3, which equals maxRetries
      // The 4th failure should go to stale instead of failed
      actor.send({ type: 'RETRY' });
      actor.send({ type: 'START_GENERATION' });
      actor.send({ type: 'GENERATION_FAILED', error: 'final error' });
      expect(actor.getSnapshot().value).toBe('stale');

      actor.stop();
    });
  });

  describe('generation progress', () => {
    it('should update progress without changing state', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'ENQUEUE' });
      actor.send({ type: 'START_GENERATION' });

      actor.send({ type: 'GENERATION_PROGRESS', progress: 50 });
      expect(actor.getSnapshot().value).toBe('regenerating');
      expect(actor.getSnapshot().context.generationProgress).toBe(50);

      actor.send({ type: 'GENERATION_PROGRESS', progress: 90 });
      expect(actor.getSnapshot().context.generationProgress).toBe(90);

      actor.stop();
    });
  });

  describe('deleted state', () => {
    it('should be a final state', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: 'MARK_DELETED' });
      expect(actor.getSnapshot().value).toBe('deleted');
      expect(actor.getSnapshot().status).toBe('done');

      actor.stop();
    });

    it('should be reachable from any active state', () => {
      // From valid
      let actor = createTestActor();
      actor.start();
      actor.send({ type: 'MARK_DELETED' });
      expect(actor.getSnapshot().value).toBe('deleted');
      actor.stop();

      // From stale
      actor = createTestActor();
      actor.start();
      actor.send({ type: 'DEPENDENCY_CHANGED' });
      actor.send({ type: 'CONFIRMED_STALE' });
      actor.send({ type: 'MARK_DELETED' });
      expect(actor.getSnapshot().value).toBe('deleted');
      actor.stop();
    });
  });
});
