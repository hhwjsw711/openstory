import { describe, expect, it, mock } from 'bun:test';

// Mock side-effect modules
mock.module('../versioned-entity-store', () => ({
  updateLifecycleState: mock().mockResolvedValue(undefined),
  getContentHash: mock().mockResolvedValue('hash'),
  getEntity: mock().mockResolvedValue(null),
  createEntity: mock().mockResolvedValue({}),
  updateEntity: mock().mockResolvedValue({}),
  getHistory: mock().mockResolvedValue([]),
}));

mock.module('../invalidation', () => ({
  broadcastLifecycleChange: mock().mockResolvedValue(undefined),
  onEntityUpdate: mock().mockResolvedValue(undefined),
  checkStaleness: mock().mockResolvedValue({
    isStale: false,
    changedDependencies: [],
  }),
  clearStaleMarkers: mock().mockResolvedValue(undefined),
  needsRegeneration: mock().mockResolvedValue(false),
}));

const { createLifecycleTracker, sendEvent } =
  await import('../entity-lifecycle');

describe('Entity Lifecycle State Machine', () => {
  describe('initial state', () => {
    it('should start in valid state', () => {
      const tracker = createLifecycleTracker('test_entity');
      expect(tracker.state).toBe('valid');
    });
  });

  describe('valid → checking → stale flow', () => {
    it('should transition to checking on DEPENDENCY_CHANGED', async () => {
      const tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      expect(tracker.state).toBe('checking');
    });

    it('should transition to stale on CONFIRMED_STALE', async () => {
      const tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      expect(tracker.state).toBe('stale');
    });

    it('should return to valid on CONFIRMED_VALID', async () => {
      const tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_VALID');
      expect(tracker.state).toBe('valid');
    });
  });

  describe('stale → queued → regenerating → valid flow', () => {
    it('should complete the full regeneration lifecycle', async () => {
      const tracker = createLifecycleTracker('test_entity');

      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      expect(tracker.state).toBe('stale');

      await sendEvent(tracker, 'ENQUEUE');
      expect(tracker.state).toBe('queued');

      await sendEvent(tracker, 'START_GENERATION');
      expect(tracker.state).toBe('regenerating');

      await sendEvent(tracker, 'GENERATION_COMPLETE');
      expect(tracker.state).toBe('valid');
    });
  });

  describe('edit during generation', () => {
    it('should transition to stale after generation completes if dependency changed during regeneration', async () => {
      const tracker = createLifecycleTracker('test_entity');

      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      await sendEvent(tracker, 'ENQUEUE');
      await sendEvent(tracker, 'START_GENERATION');
      expect(tracker.state).toBe('regenerating');

      // Dependency changes during generation
      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      expect(tracker.state).toBe('regenerating');
      expect(tracker.staleDuringGeneration).toBe(true);

      // Generation completes — but should go to stale, not valid
      await sendEvent(tracker, 'GENERATION_COMPLETE');
      expect(tracker.state).toBe('stale');
    });
  });

  describe('failure and retry', () => {
    it('should transition to failed on GENERATION_FAILED', async () => {
      const tracker = createLifecycleTracker('test_entity');

      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      await sendEvent(tracker, 'ENQUEUE');
      await sendEvent(tracker, 'START_GENERATION');
      await sendEvent(tracker, 'GENERATION_FAILED');
      expect(tracker.state).toBe('failed');
    });

    it('should allow retry from failed state', async () => {
      const tracker = createLifecycleTracker('test_entity');

      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      await sendEvent(tracker, 'ENQUEUE');
      await sendEvent(tracker, 'START_GENERATION');
      await sendEvent(tracker, 'GENERATION_FAILED');
      expect(tracker.state).toBe('failed');

      await sendEvent(tracker, 'RETRY');
      expect(tracker.state).toBe('queued');
    });

    it('should track retry count', async () => {
      const tracker = createLifecycleTracker('test_entity');

      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      await sendEvent(tracker, 'ENQUEUE');
      await sendEvent(tracker, 'START_GENERATION');
      await sendEvent(tracker, 'GENERATION_FAILED');
      expect(tracker.retryCount).toBe(1);

      await sendEvent(tracker, 'RETRY');
      await sendEvent(tracker, 'START_GENERATION');
      await sendEvent(tracker, 'GENERATION_FAILED');
      expect(tracker.retryCount).toBe(2);
    });

    it('should go to stale when max retries exceeded', async () => {
      const tracker = createLifecycleTracker('test_entity');

      // Exhaust all 3 retries
      for (let i = 0; i < 3; i++) {
        await sendEvent(tracker, 'DEPENDENCY_CHANGED');
        await sendEvent(tracker, 'CONFIRMED_STALE');
        await sendEvent(tracker, 'ENQUEUE');
        await sendEvent(tracker, 'START_GENERATION');
        await sendEvent(tracker, 'GENERATION_FAILED');
        if (i < 2) {
          await sendEvent(tracker, 'RETRY');
        }
      }

      // After 3 failures, retry count is 3 = maxRetries
      // The 4th failure should go to stale
      await sendEvent(tracker, 'RETRY');
      await sendEvent(tracker, 'START_GENERATION');
      await sendEvent(tracker, 'GENERATION_FAILED');
      expect(tracker.state).toBe('stale');
    });
  });

  describe('deleted state', () => {
    it('should be a final state', async () => {
      const tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'MARK_DELETED');
      expect(tracker.state).toBe('deleted');

      // No transitions from deleted
      const result = await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      expect(result).toBeNull();
      expect(tracker.state).toBe('deleted');
    });

    it('should be reachable from any active state', async () => {
      // From valid
      let tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'MARK_DELETED');
      expect(tracker.state).toBe('deleted');

      // From stale
      tracker = createLifecycleTracker('test_entity');
      await sendEvent(tracker, 'DEPENDENCY_CHANGED');
      await sendEvent(tracker, 'CONFIRMED_STALE');
      await sendEvent(tracker, 'MARK_DELETED');
      expect(tracker.state).toBe('deleted');
    });
  });

  describe('invalid transitions', () => {
    it('should return null for invalid transitions', async () => {
      const tracker = createLifecycleTracker('test_entity');
      // Can't ENQUEUE from valid state
      const result = await sendEvent(tracker, 'ENQUEUE');
      expect(result).toBeNull();
      expect(tracker.state).toBe('valid');
    });
  });
});
