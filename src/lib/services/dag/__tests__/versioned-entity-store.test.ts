import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { computeContentHash } from '../content-hash';

// Mock database — must mock before importing the module under test
const mockReturning = mock();
const mockValues = mock();
const mockOrderBy = mock();
const mockLimit = mock();
const mockWhere = mock();
const mockFrom = mock();
const mockFindFirst = mock();

const mockDb = {
  insert: mock(() => ({
    values: mockValues.mockReturnValue({
      returning: mockReturning,
    }),
  })),
  select: mock(() => ({
    from: mockFrom.mockReturnValue({
      where: mockWhere.mockReturnValue({
        orderBy: mockOrderBy.mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mockWhere.mockResolvedValue([]),
    })),
  })),
  query: {
    entityVersions: {
      findFirst: mockFindFirst,
    },
  },
};

mock.module('#db-client', () => ({
  getDb: () => mockDb,
}));

const mod = await import('../versioned-entity-store');

describe('VersionedEntityStore', () => {
  beforeEach(() => {
    mock.restore();
    mockReturning.mockReset();
    mockValues.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
    mockWhere.mockReset();
    mockFrom.mockReset();
    mockFindFirst.mockReset();

    // Re-setup the chain (mocks lose their return values after reset)
    mockDb.insert = mock(() => ({
      values: mockValues.mockReturnValue({
        returning: mockReturning,
      }),
    }));
    mockDb.select = mock(() => ({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          orderBy: mockOrderBy.mockReturnValue({
            limit: mockLimit,
          }),
        }),
      }),
    }));
  });

  describe('createEntity', () => {
    it('should create version 1 with computed content hash', async () => {
      const entityData = { title: 'Test Script', content: 'Hello world' };
      const hash = await computeContentHash(entityData);

      const mockRow = {
        id: 'test-id',
        entityId: 'script_001',
        version: 1,
        branchName: 'main',
        parentVersion: null,
        contentHash: hash,
        data: entityData,
        entityType: 'script',
        lifecycleState: 'valid',
        createdBy: 'user_001',
        createdAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockRow]);

      const result = await mod.createEntity(
        'script_001',
        'script',
        entityData,
        'user_001'
      );

      expect(result.entityId).toBe('script_001');
      expect(result.version).toBe(1);
      expect(result.data).toEqual(entityData);
      expect(result.entityType).toBe('script');
      expect(result.lifecycleState).toBe('valid');
    });
  });

  describe('updateEntity', () => {
    it('should skip update when content hash is unchanged', async () => {
      const data = { title: 'Same Content' };
      const hash = await computeContentHash(data);

      const existingRow = {
        id: 'test-id',
        entityId: 'entity_001',
        version: 1,
        branchName: 'main',
        parentVersion: null,
        contentHash: hash,
        data,
        entityType: 'script',
        lifecycleState: 'valid',
        createdBy: null,
        createdAt: new Date(),
      };

      // getLatestVersion returns the existing row
      mockLimit.mockResolvedValue([existingRow]);

      const result = await mod.updateEntity('entity_001', data);

      // Should return existing entity without inserting (hash unchanged)
      expect(result.version).toBe(1);
      expect(result.contentHash).toBe(hash);
    });
  });

  describe('getEntity', () => {
    it('should return null for non-existent entity', async () => {
      mockLimit.mockResolvedValue([]);

      const result = await mod.getEntity('nonexistent');
      expect(result).toBeNull();
    });

    it('should return specific version when requested', async () => {
      const mockRow = {
        id: 'test-id',
        entityId: 'entity_001',
        version: 3,
        branchName: 'main',
        parentVersion: 2,
        contentHash: 'hash_v3',
        data: { title: 'Version 3' },
        entityType: 'script',
        lifecycleState: 'valid',
        createdBy: null,
        createdAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockRow);

      const result = await mod.getEntity('entity_001', 3);
      expect(result?.version).toBe(3);
      expect(result?.data).toEqual({ title: 'Version 3' });
    });
  });

  describe('getHistory', () => {
    it('should return versions in descending order', async () => {
      const rows = [
        {
          id: '3',
          entityId: 'e1',
          version: 3,
          branchName: 'main',
          parentVersion: 2,
          contentHash: 'h3',
          data: { v: 3 },
          entityType: 'script',
          lifecycleState: 'valid',
          createdBy: null,
          createdAt: new Date(),
        },
        {
          id: '2',
          entityId: 'e1',
          version: 2,
          branchName: 'main',
          parentVersion: 1,
          contentHash: 'h2',
          data: { v: 2 },
          entityType: 'script',
          lifecycleState: 'valid',
          createdBy: null,
          createdAt: new Date(),
        },
        {
          id: '1',
          entityId: 'e1',
          version: 1,
          branchName: 'main',
          parentVersion: null,
          contentHash: 'h1',
          data: { v: 1 },
          entityType: 'script',
          lifecycleState: 'valid',
          createdBy: null,
          createdAt: new Date(),
        },
      ];

      mockDb.select = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock().mockResolvedValue(rows),
          })),
        })),
      }));

      const history = await mod.getHistory('e1');
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(3);
      expect(history[2].version).toBe(1);
    });
  });
});
