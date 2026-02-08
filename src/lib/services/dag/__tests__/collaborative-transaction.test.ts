import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Track what updateEntity was called with
const mockUpdateEntityFn = mock();
const mockGetEntityFn = mock();

// Mock versioned entity store
mock.module('../versioned-entity-store', () => ({
  getEntity: mockGetEntityFn,
  updateEntity: mockUpdateEntityFn,
  getContentHash: mock().mockResolvedValue('hash'),
}));

// Mock Redis
mock.module('#redis', () => ({
  getRedis: () => ({
    publish: mock().mockResolvedValue(1),
    sadd: mock().mockResolvedValue(1),
    smembers: mock().mockResolvedValue([]),
    del: mock().mockResolvedValue(1),
  }),
}));

// Mock db-client (needed by dependency-graph which is used by invalidation)
mock.module('#db-client', () => ({
  getDb: () => ({
    select: mock().mockReturnValue({
      from: mock().mockReturnValue({
        where: mock().mockResolvedValue([]),
      }),
    }),
  }),
}));

const { applyTransaction, applyTransactionBatch } =
  await import('../collaborative-transaction');

describe('Collaborative Transaction', () => {
  beforeEach(() => {
    mockGetEntityFn.mockClear();
    mockUpdateEntityFn.mockClear();
  });

  describe('applyTransaction', () => {
    it('should apply update when baseVersion matches', async () => {
      const currentEntity = {
        entityId: 'scene_001',
        version: 3,
        contentHash: 'hash_v3',
        data: { title: 'Original Title', description: 'A scene' },
        entityType: 'scene',
        lifecycleState: 'valid',
      };

      mockGetEntityFn.mockResolvedValue(currentEntity);
      mockUpdateEntityFn.mockResolvedValue({
        ...currentEntity,
        version: 4,
        contentHash: 'hash_v4',
        data: { title: 'New Title', description: 'A scene' },
      });

      const result = await applyTransaction({
        type: 'update',
        entityId: 'scene_001',
        baseVersion: 3,
        property: 'title',
        oldValue: 'Original Title',
        newValue: 'New Title',
        userId: 'user_001',
      });

      expect(result.status).toBe('applied');
      if (result.status === 'applied') {
        expect(result.newVersion).toBe(4);
      }
    });

    it('should return conflict when baseVersion does not match', async () => {
      mockGetEntityFn.mockResolvedValue({
        entityId: 'scene_001',
        version: 5, // Current version is 5, not 3
        contentHash: 'hash_v5',
        data: { title: 'Updated by other user', description: 'A scene' },
      });

      const result = await applyTransaction({
        type: 'update',
        entityId: 'scene_001',
        baseVersion: 3,
        property: 'title',
        oldValue: 'Original Title',
        newValue: 'My Title',
        userId: 'user_002',
      });

      expect(result.status).toBe('conflict');
      if (result.status === 'conflict') {
        expect(result.currentVersion).toBe(5);
        expect(result.currentData).toEqual({
          title: 'Updated by other user',
          description: 'A scene',
        });
      }
    });

    it('should throw for non-existent entity', async () => {
      mockGetEntityFn.mockResolvedValue(null);

      expect(() =>
        applyTransaction({
          type: 'update',
          entityId: 'nonexistent',
          baseVersion: 1,
          property: 'title',
          oldValue: 'old',
          newValue: 'new',
          userId: 'user_001',
        })
      ).toThrow('Entity nonexistent not found');
    });
  });

  describe('applyTransactionBatch', () => {
    it('should apply multiple property updates atomically', async () => {
      const currentEntity = {
        entityId: 'scene_001',
        version: 1,
        contentHash: 'hash_v1',
        data: { title: 'Title', description: 'Desc', location: 'Office' },
      };

      mockGetEntityFn.mockResolvedValue(currentEntity);
      mockUpdateEntityFn.mockResolvedValue({
        ...currentEntity,
        version: 2,
        contentHash: 'hash_v2',
        data: {
          title: 'New Title',
          description: 'New Desc',
          location: 'Office',
        },
      });

      const result = await applyTransactionBatch([
        {
          type: 'update',
          entityId: 'scene_001',
          baseVersion: 1,
          property: 'title',
          oldValue: 'Title',
          newValue: 'New Title',
          userId: 'user_001',
        },
        {
          type: 'update',
          entityId: 'scene_001',
          baseVersion: 1,
          property: 'description',
          oldValue: 'Desc',
          newValue: 'New Desc',
          userId: 'user_001',
        },
      ]);

      expect(result.status).toBe('applied');
    });

    it('should reject batch with mixed entities', async () => {
      let thrownError: Error | undefined;
      try {
        await applyTransactionBatch([
          {
            type: 'update',
            entityId: 'scene_001',
            baseVersion: 1,
            property: 'title',
            oldValue: 'a',
            newValue: 'b',
            userId: 'user_001',
          },
          {
            type: 'update',
            entityId: 'scene_002', // Different entity!
            baseVersion: 1,
            property: 'title',
            oldValue: 'c',
            newValue: 'd',
            userId: 'user_001',
          },
        ]);
      } catch (e) {
        thrownError = e instanceof Error ? e : new Error(String(e));
      }
      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain('must target the same entity');
    });
  });
});
