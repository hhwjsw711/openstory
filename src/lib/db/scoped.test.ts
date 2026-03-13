// @ts-nocheck — test sentinels are intentionally partial objects
import { describe, expect, it, mock, beforeEach } from 'bun:test';

// Mocks for delegated helpers (unchanged operations)
const mockGetSequencesByTeam = mock();
const mockCreateSequence = mock();
const mockGetTeamTalent = mock();
const mockGetTalentByIds = mock();
const mockCreateTalent = mock();
const mockUpdateTalent = mock();
const mockDeleteTalent = mock();
const mockToggleTalentFavorite = mock();
const mockGetTeamAndPublicStyles = mock();
const mockGetTeamLibrary = mock();
const mockCreateStyle = mock();
const mockUpdateStyle = mock();
const mockDeleteStyle = mock();
const mockGetTeamLibraryLocations = mock();
const mockSearchLibraryLocations = mock();
const mockCreateLibraryLocation = mock();
const mockGetLibraryLocationsWithReferences = mock();
const mockUpdateLibraryLocation = mock();
const mockGetCharacterById = mock();

// Chainable mock for inline DB operations (sequence + locationSheets)
const mockWhere = mock();
const mockSet = mock();
const mockFrom = mock();
const mockUpdate = mock();
const mockSelect = mock();
const mockInsert = mock();
const mockValues = mock();
const mockReturning = mock();
const mockDeleteOp = mock();
const mockInnerJoin = mock();
const mockLimit = mock();

function wireDbChain() {
  const chain = {
    update: mockUpdate,
    set: mockSet,
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    delete: mockDeleteOp,
    innerJoin: mockInnerJoin,
    limit: mockLimit,
  };

  // Intermediate methods return chain for fluent chaining
  mockUpdate.mockReturnValue(chain);
  mockSet.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockValues.mockReturnValue(chain);
  mockDeleteOp.mockReturnValue(chain);
  mockInnerJoin.mockReturnValue(chain);

  // where() may be terminal OR intermediate (.where().limit()).
  // Return a promise-like object that also has chain methods for further chaining.
  const whereResult = Object.assign(Promise.resolve([]), { limit: mockLimit });
  mockWhere.mockReturnValue(whereResult);

  // limit() and returning() are always terminal — return empty arrays
  mockLimit.mockResolvedValue([]);
  mockReturning.mockResolvedValue([]);

  return chain;
}

// Wire chain once — getDb() returns pre-built chain, not re-wired each call
let dbChain: ReturnType<typeof wireDbChain>;
const mockGetDb = mock(() => dbChain);

mock.module('#db-client', () => ({
  getDb: mockGetDb,
}));
mock.module('@/lib/db/helpers/sequences', () => ({
  getSequencesByTeam: mockGetSequencesByTeam,
  createSequence: mockCreateSequence,
}));
mock.module('@/lib/db/helpers/talent', () => ({
  getTeamTalent: mockGetTeamTalent,
  getTalentByIds: mockGetTalentByIds,
  createTalent: mockCreateTalent,
  updateTalent: mockUpdateTalent,
  deleteTalent: mockDeleteTalent,
  toggleTalentFavorite: mockToggleTalentFavorite,
}));
mock.module('@/lib/db/helpers/queries', () => ({
  getTeamAndPublicStyles: mockGetTeamAndPublicStyles,
  getTeamLibrary: mockGetTeamLibrary,
}));
mock.module('@/lib/db/helpers/styles', () => ({
  createStyle: mockCreateStyle,
  updateStyle: mockUpdateStyle,
  deleteStyle: mockDeleteStyle,
}));
mock.module('@/lib/db/helpers/location-library', () => ({
  getTeamLibraryLocations: mockGetTeamLibraryLocations,
  searchLibraryLocations: mockSearchLibraryLocations,
  createLibraryLocation: mockCreateLibraryLocation,
  getLibraryLocationsWithReferences: mockGetLibraryLocationsWithReferences,
  updateLibraryLocation: mockUpdateLibraryLocation,
}));
mock.module('@/lib/db/helpers/sequence-characters', () => ({
  getCharacterById: mockGetCharacterById,
}));

const { createScopedDb } = await import('./scoped');

const TEAM_ID = 'team_01';

describe('createScopedDb', () => {
  beforeEach(() => {
    // Clear delegated helper mocks
    mockGetSequencesByTeam.mockClear();
    mockCreateSequence.mockClear();
    mockGetTeamTalent.mockClear();
    mockGetTalentByIds.mockClear();
    mockCreateTalent.mockClear();
    mockUpdateTalent.mockClear();
    mockDeleteTalent.mockClear();
    mockToggleTalentFavorite.mockClear();
    mockGetTeamAndPublicStyles.mockClear();
    mockGetTeamLibrary.mockClear();
    mockCreateStyle.mockClear();
    mockUpdateStyle.mockClear();
    mockDeleteStyle.mockClear();
    mockGetTeamLibraryLocations.mockClear();
    mockSearchLibraryLocations.mockClear();
    mockCreateLibraryLocation.mockClear();
    mockGetLibraryLocationsWithReferences.mockClear();
    mockUpdateLibraryLocation.mockClear();
    mockGetCharacterById.mockClear();

    // Clear inline DB mocks
    mockGetDb.mockClear();
    mockUpdate.mockClear();
    mockSet.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockInsert.mockClear();
    mockValues.mockClear();
    mockReturning.mockClear();
    mockDeleteOp.mockClear();
    mockInnerJoin.mockClear();
    mockLimit.mockClear();

    // Re-wire chain after clearing and assign to dbChain for getDb()
    dbChain = wireDbChain();
  });

  it('exposes teamId', () => {
    const db = createScopedDb(TEAM_ID);
    expect(db.teamId).toBe(TEAM_ID);
  });

  describe('sequences', () => {
    it('list() calls getSequencesByTeam with teamId', async () => {
      const sentinel = [{ id: 'seq_1' }];
      mockGetSequencesByTeam.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.sequences.list();

      expect(mockGetSequencesByTeam).toHaveBeenCalledWith(TEAM_ID);
      expect(result).toBe(sentinel);
    });

    it('create() calls createSequence with teamId injected', async () => {
      const sentinel = { id: 'seq_2' };
      mockCreateSequence.mockReturnValue(sentinel);

      const params = {
        userId: 'user_1',
        title: 'Test',
        styleId: 'style_1',
        analysisModel: 'model_1',
      };

      const db = createScopedDb(TEAM_ID);
      const result = db.sequences.create(params);

      expect(mockCreateSequence).toHaveBeenCalledWith({
        ...params,
        teamId: TEAM_ID,
      });
      expect(result).toBe(sentinel);
    });
  });

  describe('sequence()', () => {
    it('exposes sequenceId', () => {
      const db = createScopedDb(TEAM_ID);
      const seq = db.sequence('seq_01');
      expect(seq.sequenceId).toBe('seq_01');
    });

    it('updateStatus() calls getDb and updates with correct fields', async () => {
      mockWhere.mockResolvedValue(undefined);

      const db = createScopedDb(TEAM_ID);
      await db.sequence('seq_01').updateStatus('processing');

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
          statusError: null,
        })
      );
    });

    it('updateStatus() passes error parameter', async () => {
      mockWhere.mockResolvedValue(undefined);

      const db = createScopedDb(TEAM_ID);
      await db.sequence('seq_01').updateStatus('failed', 'Something broke');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          statusError: 'Something broke',
        })
      );
    });

    it('updateMusicFields() calls getDb and updates with spread fields', async () => {
      mockWhere.mockResolvedValue(undefined);

      const fields = { musicStatus: 'generating' as const, musicError: null };
      const db = createScopedDb(TEAM_ID);
      await db.sequence('seq_01').updateMusicFields(fields);

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          musicStatus: 'generating',
          musicError: null,
        })
      );
    });

    it('updateMergedVideoFields() calls getDb and updates with spread fields', async () => {
      mockWhere.mockResolvedValue(undefined);

      const fields = {
        mergedVideoStatus: 'merging' as const,
        mergedVideoError: null,
      };
      const db = createScopedDb(TEAM_ID);
      await db.sequence('seq_01').updateMergedVideoFields(fields);

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          mergedVideoStatus: 'merging',
          mergedVideoError: null,
        })
      );
    });

    it('getMusicStatus() returns row from getDb select', async () => {
      const sentinel = { musicStatus: 'completed', musicUrl: 'url' };
      mockWhere.mockResolvedValue([sentinel]);

      const db = createScopedDb(TEAM_ID);
      const result = await db.sequence('seq_01').getMusicStatus();

      expect(mockGetDb).toHaveBeenCalled();
      expect(result).toEqual(sentinel);
    });

    it('getMergedVideoStatus() returns row from getDb select', async () => {
      const sentinel = {
        mergedVideoStatus: 'completed',
        mergedVideoUrl: 'url',
      };
      mockWhere.mockResolvedValue([sentinel]);

      const db = createScopedDb(TEAM_ID);
      const result = await db.sequence('seq_01').getMergedVideoStatus();

      expect(mockGetDb).toHaveBeenCalled();
      expect(result).toEqual(sentinel);
    });
  });

  describe('talent', () => {
    it('list() calls getTeamTalent with teamId', () => {
      const sentinel = [{ id: 'talent_1' }];
      mockGetTeamTalent.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.talent.list();

      expect(mockGetTeamTalent).toHaveBeenCalledWith(TEAM_ID, undefined);
      expect(result).toBe(sentinel);
    });

    it('list() forwards options', () => {
      mockGetTeamTalent.mockReturnValue([]);

      const db = createScopedDb(TEAM_ID);
      db.talent.list({ favoritesOnly: true });

      expect(mockGetTeamTalent).toHaveBeenCalledWith(TEAM_ID, {
        favoritesOnly: true,
      });
    });

    it('getByIds() calls getTalentByIds with teamId', () => {
      const sentinel = [{ id: 'talent_1' }];
      mockGetTalentByIds.mockReturnValue(sentinel);

      const ids = ['talent_1', 'talent_2'];
      const db = createScopedDb(TEAM_ID);
      const result = db.talent.getByIds(ids);

      expect(mockGetTalentByIds).toHaveBeenCalledWith(ids, TEAM_ID);
      expect(result).toBe(sentinel);
    });

    it('create() calls createTalent with teamId injected', () => {
      const sentinel = { id: 'talent_3' };
      mockCreateTalent.mockReturnValue(sentinel);

      const data = { name: 'Actor', createdBy: 'user_1' };
      const db = createScopedDb(TEAM_ID);
      const result = db.talent.create(data as any);

      expect(mockCreateTalent).toHaveBeenCalledWith({
        ...data,
        teamId: TEAM_ID,
      });
      expect(result).toBe(sentinel);
    });

    it('update() calls updateTalent with teamId', () => {
      const sentinel = { id: 'talent_1' };
      mockUpdateTalent.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.talent.update('talent_1', { name: 'Updated' });

      expect(mockUpdateTalent).toHaveBeenCalledWith('talent_1', TEAM_ID, {
        name: 'Updated',
      });
      expect(result).toBe(sentinel);
    });

    it('delete() calls deleteTalent with teamId', () => {
      const sentinel = { success: true };
      mockDeleteTalent.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.talent.delete('talent_1');

      expect(mockDeleteTalent).toHaveBeenCalledWith('talent_1', TEAM_ID);
      expect(result).toBe(sentinel);
    });

    it('toggleFavorite() calls toggleTalentFavorite with teamId', () => {
      const sentinel = { isFavorite: true };
      mockToggleTalentFavorite.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.talent.toggleFavorite('talent_1');

      expect(mockToggleTalentFavorite).toHaveBeenCalledWith(
        'talent_1',
        TEAM_ID
      );
      expect(result).toBe(sentinel);
    });
  });

  describe('styles', () => {
    it('list() calls getTeamAndPublicStyles with teamId', () => {
      const sentinel = [{ id: 'style_1' }];
      mockGetTeamAndPublicStyles.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.styles.list();

      expect(mockGetTeamAndPublicStyles).toHaveBeenCalledWith(TEAM_ID);
      expect(result).toBe(sentinel);
    });

    it('create() calls createStyle with teamId injected', () => {
      const sentinel = { id: 'style_2' };
      mockCreateStyle.mockReturnValue(sentinel);

      const data = { name: 'Noir', createdBy: 'user_1' };
      const db = createScopedDb(TEAM_ID);
      const result = db.styles.create(data as any);

      expect(mockCreateStyle).toHaveBeenCalledWith({
        ...data,
        teamId: TEAM_ID,
      });
      expect(result).toBe(sentinel);
    });

    it('update() calls updateStyle with teamId', () => {
      const sentinel = { id: 'style_1' };
      mockUpdateStyle.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.styles.update('style_1', { name: 'Updated' });

      expect(mockUpdateStyle).toHaveBeenCalledWith('style_1', TEAM_ID, {
        name: 'Updated',
      });
      expect(result).toBe(sentinel);
    });

    it('delete() calls deleteStyle with teamId', () => {
      const sentinel = { success: true };
      mockDeleteStyle.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.styles.delete('style_1');

      expect(mockDeleteStyle).toHaveBeenCalledWith('style_1', TEAM_ID);
      expect(result).toBe(sentinel);
    });
  });

  describe('locations', () => {
    it('list() calls getTeamLibraryLocations with teamId', () => {
      const sentinel = [{ id: 'loc_1' }];
      mockGetTeamLibraryLocations.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.locations.list();

      expect(mockGetTeamLibraryLocations).toHaveBeenCalledWith(TEAM_ID);
      expect(result).toBe(sentinel);
    });

    it('search() calls searchLibraryLocations with teamId and args', () => {
      const sentinel = [{ id: 'loc_1' }];
      mockSearchLibraryLocations.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.locations.search('park', 5);

      expect(mockSearchLibraryLocations).toHaveBeenCalledWith(
        TEAM_ID,
        'park',
        5
      );
      expect(result).toBe(sentinel);
    });

    it('create() calls createLibraryLocation with teamId injected', () => {
      const sentinel = { id: 'loc_2' };
      mockCreateLibraryLocation.mockReturnValue(sentinel);

      const data = { name: 'Beach', createdBy: 'user_1' };
      const db = createScopedDb(TEAM_ID);
      const result = db.locations.create(data as any);

      expect(mockCreateLibraryLocation).toHaveBeenCalledWith({
        ...data,
        teamId: TEAM_ID,
      });
      expect(result).toBe(sentinel);
    });

    it('withReferences() calls getLibraryLocationsWithReferences with teamId', () => {
      const sentinel = [{ id: 'loc_1', references: [] }];
      mockGetLibraryLocationsWithReferences.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.locations.withReferences();

      expect(mockGetLibraryLocationsWithReferences).toHaveBeenCalledWith(
        TEAM_ID
      );
      expect(result).toBe(sentinel);
    });
  });

  describe('locationSheets', () => {
    it('list() calls getDb and queries by locationId', async () => {
      const sentinel = [{ id: 'sheet_1' }];
      mockWhere.mockResolvedValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      await db.locationSheets.list('loc_01');

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
    });

    it('insert() calls getDb with values and returning', async () => {
      const sentinel = [{ id: 'sheet_2' }];
      mockReturning.mockResolvedValue(sentinel);

      const sheets = [
        { locationId: 'loc_01', name: 'Night', source: 'manual_upload' },
      ];
      const db = createScopedDb(TEAM_ID);
      await db.locationSheets.insert(sheets as any);

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('insert() returns empty array for empty input', async () => {
      const db = createScopedDb(TEAM_ID);
      const result = await db.locationSheets.insert([]);

      expect(result).toEqual([]);
      expect(mockGetDb).not.toHaveBeenCalled();
    });

    it('delete() calls getDb and deletes by sheetId', async () => {
      mockWhere.mockResolvedValue(undefined);

      const db = createScopedDb(TEAM_ID);
      await db.locationSheets.delete('sheet_01');

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockDeleteOp).toHaveBeenCalled();
    });

    it('getWithLocation() calls getDb with innerJoin', async () => {
      const sentinel = {
        sheet: { id: 'sheet_01' },
        location: { id: 'loc_01' },
      };
      mockWhere.mockResolvedValue([sentinel]);

      const db = createScopedDb(TEAM_ID);
      const result = await db.locationSheets.getWithLocation('sheet_01');

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockInnerJoin).toHaveBeenCalled();
      expect(result).toEqual(sentinel);
    });

    it('getWithLocation() returns null when not found', async () => {
      mockWhere.mockResolvedValue([]);

      const db = createScopedDb(TEAM_ID);
      const result = await db.locationSheets.getWithLocation('sheet_99');

      expect(result).toBeNull();
    });

    it('promoteDefault() promotes next sheet when one exists', async () => {
      const nextSheet = { id: 'sheet_02', imageUrl: 'url', imagePath: 'path' };
      mockLimit.mockResolvedValue([nextSheet]);

      const db = createScopedDb(TEAM_ID);
      await db.locationSheets.promoteDefault('loc_01');

      expect(mockGetDb).toHaveBeenCalled();
      expect(mockUpdateLibraryLocation).toHaveBeenCalledWith('loc_01', {
        referenceImageUrl: 'url',
        referenceImagePath: 'path',
      });
    });

    it('promoteDefault() clears reference when no sheets remain', async () => {
      mockLimit.mockResolvedValue([]);

      const db = createScopedDb(TEAM_ID);
      await db.locationSheets.promoteDefault('loc_01');

      expect(mockUpdateLibraryLocation).toHaveBeenCalledWith('loc_01', {
        referenceImageUrl: null,
        referenceImagePath: null,
      });
    });
  });

  describe('characters', () => {
    it('getById() calls getCharacterById', () => {
      const sentinel = { id: 'char_01', name: 'Hero' };
      mockGetCharacterById.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.characters.getById('char_01');

      expect(mockGetCharacterById).toHaveBeenCalledWith('char_01');
      expect(result).toBe(sentinel);
    });
  });

  describe('library', () => {
    it('getAll() calls getTeamLibrary with teamId', () => {
      const sentinel = { styles: [], talent: [] };
      mockGetTeamLibrary.mockReturnValue(sentinel);

      const db = createScopedDb(TEAM_ID);
      const result = db.library.getAll();

      expect(mockGetTeamLibrary).toHaveBeenCalledWith(TEAM_ID);
      expect(result).toBe(sentinel);
    });
  });
});
