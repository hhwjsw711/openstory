import { describe, expect, it, mock, beforeEach } from 'bun:test';

// --- Mocks ---

let mockGiftTokenRows: Record<string, unknown>[] = [];
let mockInsertedValues: Record<string, unknown>[] = [];
let mockUpdatedValues: Record<string, unknown>[] = [];
let mockAddCreditsResult = { newBalance: 50, transactionId: 'tx-1' };

function createSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.select = mock(() => chain);
  chain.from = mock(() => chain);
  chain.where = mock(() => chain);
  chain.limit = mock(() => [...mockGiftTokenRows]);
  chain.orderBy = mock(() => [...mockGiftTokenRows]);
  return chain;
}

function createInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.insert = mock(() => chain);
  chain.values = mock((vals: Record<string, unknown>) => {
    mockInsertedValues.push(vals);
    return chain;
  });
  chain.returning = mock(() => [{ ...vals(), id: 'gt-1', code: 'HK7NWE' }]);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.update = mock(() => chain);
  chain.set = mock((vals: Record<string, unknown>) => {
    mockUpdatedValues.push(vals);
    return chain;
  });
  chain.where = mock(() => chain);
  chain.returning = mock(() => []);
  return chain;
}

function vals() {
  return mockInsertedValues[mockInsertedValues.length - 1] ?? {};
}

// Build a mock db that returns the right chain based on method
let selectChain = createSelectChain();
let insertChain = createInsertChain();
let updateChain = createUpdateChain();

type MockFn = (...args: unknown[]) => unknown;

const mockDb = {
  select: (...args: unknown[]) => (selectChain.select as MockFn)(...args),
  insert: (...args: unknown[]) => (insertChain.insert as MockFn)(...args),
  update: (...args: unknown[]) => (updateChain.update as MockFn)(...args),
};

mock.module('#db-client', () => ({
  getDb: () => mockDb,
}));

mock.module('./credit-service', () => ({
  addCredits: mock(async () => mockAddCreditsResult),
}));

const { generateGiftCode, redeemGiftToken, getGiftTokenStatus } =
  await import('./gift-token.service');

// --- Tests ---

describe('generateGiftCode', () => {
  it('returns a 6-character string from the valid alphabet', () => {
    const code = generateGiftCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => generateGiftCode())
    );
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe('getGiftTokenStatus', () => {
  function tokenWith(
    overrides: Partial<{ redeemedAt: Date | null; expiresAt: Date | null }>
  ) {
    return {
      id: 'gt-test',
      code: 'TEST01',
      amountUsd: 10,
      createdByUserId: 'user-1',
      redeemedByTeamId: null,
      redeemedByUserId: null,
      redeemedAt: null,
      expiresAt: null,
      note: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it('returns available for unredeemed, unexpired token', () => {
    expect(getGiftTokenStatus(tokenWith({}))).toBe('available');
  });

  it('returns redeemed when redeemedAt is set', () => {
    expect(getGiftTokenStatus(tokenWith({ redeemedAt: new Date() }))).toBe(
      'redeemed'
    );
  });

  it('returns expired when expiresAt is in the past', () => {
    expect(
      getGiftTokenStatus(tokenWith({ expiresAt: new Date(Date.now() - 1000) }))
    ).toBe('expired');
  });
});

describe('redeemGiftToken', () => {
  beforeEach(() => {
    mockGiftTokenRows = [];
    mockInsertedValues = [];
    mockUpdatedValues = [];
    selectChain = createSelectChain();
    insertChain = createInsertChain();
    updateChain = createUpdateChain();

    // Re-wire the mockDb
    mockDb.select = (...args: unknown[]) =>
      (selectChain.select as MockFn)(...args);
    mockDb.insert = (...args: unknown[]) =>
      (insertChain.insert as MockFn)(...args);
    mockDb.update = (...args: unknown[]) =>
      (updateChain.update as MockFn)(...args);
  });

  it('throws on invalid code', async () => {
    mockGiftTokenRows = [];
    try {
      await redeemGiftToken({
        code: 'BADCODE',
        teamId: 'team-1',
        userId: 'user-1',
      });
      throw new Error('Expected error');
    } catch (err) {
      expect((err as Error).message).toBe('Invalid gift code');
    }
  });

  it('throws on already redeemed code', async () => {
    mockGiftTokenRows = [
      {
        id: 'gt-1',
        code: 'HK7NWE',
        amountUsd: 10,
        redeemedAt: new Date(),
        expiresAt: null,
      },
    ];
    try {
      await redeemGiftToken({
        code: 'HK7NWE',
        teamId: 'team-1',
        userId: 'user-1',
      });
      throw new Error('Expected error');
    } catch (err) {
      expect((err as Error).message).toBe(
        'This gift code has already been redeemed'
      );
    }
  });

  it('throws on expired code', async () => {
    mockGiftTokenRows = [
      {
        id: 'gt-1',
        code: 'HK7NWE',
        amountUsd: 10,
        redeemedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      },
    ];
    try {
      await redeemGiftToken({
        code: 'HK7NWE',
        teamId: 'team-1',
        userId: 'user-1',
      });
      throw new Error('Expected error');
    } catch (err) {
      expect((err as Error).message).toBe('This gift code has expired');
    }
  });
});
