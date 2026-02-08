import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock database
const mockInsert = mock();
const mockDelete = mock();
const mockSelect = mock();
const mockValues = mock();
const mockWhere = mock();
const mockFrom = mock();
const mockOnConflictDoNothing = mock();

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
};

mock.module('#db-client', () => ({
  getDb: () => mockDb,
}));

// Mock Redis (used by invalidation which dependency-graph doesn't use directly,
// but is needed for import chain)
mock.module('#redis', () => ({
  getRedis: () => ({
    sadd: mock().mockResolvedValue(1),
    smembers: mock().mockResolvedValue([]),
    del: mock().mockResolvedValue(1),
    publish: mock().mockResolvedValue(1),
    hset: mock().mockResolvedValue(1),
    hgetall: mock().mockResolvedValue({}),
  }),
}));

const { addDependency, getDependencies, getDependents, getRegenerationOrder } =
  await import('../dependency-graph');

describe('DependencyGraph', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockDelete.mockClear();
    mockSelect.mockClear();
    mockValues.mockClear();
    mockWhere.mockClear();
    mockFrom.mockClear();
    mockOnConflictDoNothing.mockClear();
  });

  describe('addDependency', () => {
    it('should insert a dependency edge', async () => {
      mockInsert.mockReturnValue({
        values: mockValues.mockReturnValue({
          onConflictDoNothing:
            mockOnConflictDoNothing.mockResolvedValue(undefined),
        }),
      });

      await addDependency('frame_001', 'scene_001', 'scene_frame');

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith({
        dependentId: 'frame_001',
        dependencyId: 'scene_001',
        dependencyType: 'scene_frame',
      });
    });
  });

  describe('getDependencies', () => {
    it('should return upstream dependencies', async () => {
      const mockDeps = [
        {
          dependentId: 'frame_001',
          dependencyId: 'scene_001',
          dependencyType: 'scene_frame',
        },
        {
          dependentId: 'frame_001',
          dependencyId: 'char_001',
          dependencyType: 'character_frame',
        },
      ];

      mockSelect.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockResolvedValue(mockDeps),
        }),
      });

      const deps = await getDependencies('frame_001');
      expect(deps).toHaveLength(2);
      expect(deps[0].dependencyId).toBe('scene_001');
      expect(deps[1].dependencyId).toBe('char_001');
    });
  });

  describe('getDependents', () => {
    it('should return downstream dependents', async () => {
      const mockDeps = [
        {
          dependentId: 'scene_001',
          dependencyId: 'script_001',
          dependencyType: 'script_scene',
        },
        {
          dependentId: 'cast_001',
          dependencyId: 'script_001',
          dependencyType: 'script_cast',
        },
      ];

      mockSelect.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockResolvedValue(mockDeps),
        }),
      });

      const dependents = await getDependents('script_001');
      expect(dependents).toHaveLength(2);
    });
  });

  describe('getRegenerationOrder', () => {
    it('should return empty array for empty input', async () => {
      const order = await getRegenerationOrder([]);
      expect(order).toEqual([]);
    });

    it('should return topological order for a linear dependency chain', async () => {
      // scene_001 depends on script_001 (not in stale set)
      // frame_001 depends on scene_001 (in stale set)
      // So within the stale subgraph, frame_001 depends on scene_001
      // Expected order: scene_001 first, then frame_001

      // getDependencies is called for each stale entity
      // For scene_001: it depends on script_001 (not in stale set, so ignored)
      // For frame_001: it depends on scene_001 (in stale set, so counted)
      const callResponses = [
        // First call: getDependencies('frame_001')
        [
          {
            dependentId: 'frame_001',
            dependencyId: 'scene_001',
            dependencyType: 'scene_frame',
          },
        ],
        // Second call: getDependencies('scene_001')
        [
          {
            dependentId: 'scene_001',
            dependencyId: 'script_001',
            dependencyType: 'script_scene',
          },
        ],
      ];

      let callIdx = 0;
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => {
            const result = callResponses[callIdx] ?? [];
            callIdx++;
            return Promise.resolve(result);
          },
        }),
      }));

      const order = await getRegenerationOrder(['frame_001', 'scene_001']);

      // scene_001 should come before frame_001
      const sceneIdx = order.indexOf('scene_001');
      const frameIdx = order.indexOf('frame_001');
      expect(sceneIdx).toBeLessThan(frameIdx);
      expect(order).toHaveLength(2);
    });

    it('should handle entities with no dependencies between them', async () => {
      // Two independent entities in the stale set
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }));

      const order = await getRegenerationOrder(['entity_a', 'entity_b']);
      expect(order).toHaveLength(2);
      expect(order).toContain('entity_a');
      expect(order).toContain('entity_b');
    });
  });
});
