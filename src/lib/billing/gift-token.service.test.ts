import { describe, expect, it, mock, beforeEach } from 'bun:test';

// --- Mocks ---

let mockGiftTokenRows: Record<string, unknown>[] = [];
let mockRedemptionCountRows: { value: number }[] = [{ value: 0 }];
let mockInsertedValues: Record<string, unknown>[] = [];
let mockInsertReturning: Record<string, unknown>[] = [];
let mockAddCreditsResult = { newBalance: 50, transactionId: 'tx-1' };

type MockFn = (...args: unknown[]) => unknown;

// Track select call order: 1 = token lookup, 2 = count redemptions
let selectCallCount = 0;

function createSelectChain() {
  const resolveData = () => {
    if (selectCallCount === 1) return [...mockGiftTokenRows];
    if (selectCallCount === 2) return [...mockRedemptionCountRows];
    return [];
  };

  const chain: Record<string | symbol, unknown> = {};
  chain.select = mock(() => {
    selectCallCount++;
    return chain;
  });
  chain.from = mock(() => chain);
  chain.where = mock(() => chain);
  chain.limit = mock(() => resolveData());
  // Make chain awaitable for queries without .limit() (e.g. count query)
  chain.then = (resolve: (v: unknown[]) => void) =>
    Promise.resolve(resolveData()).then(resolve);
  chain.orderBy = mock(() => [...mockGiftTokenRows]);
  chain.leftJoin = mock(() => chain);
  chain.groupBy = mock(() => chain);
  chain.as = mock(() => chain);
  return chain;
}

function createInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.insert = mock(() => chain);
  chain.values = mock((vals: Record<string, unknown>) => {
    mockInsertedValues.push(vals);
    return chain;
  });
  chain.onConflictDoNothing = mock(() => chain);
  chain.returning = mock(() => [...mockInsertReturning]);
  return chain;
}

let selectChain = createSelectChain();
let insertChain = createInsertChain();

const mockDb = {
  select: (...args: unknown[]) => (selectChain.select as MockFn)(...args),
  insert: (...args: unknown[]) => (insertChain.insert as MockFn)(...args),
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
    overrides: Partial<{ maxRedemptions: number; expiresAt: Date | null }>
  ) {
    return {
      id: 'gt-test',
      code: 'TEST01',
      amountMicros: 10,
      maxRedemptions: 1,
      createdByUserId: 'user-1',
      expiresAt: null,
      note: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it('returns available for unredeemed, unexpired token', () => {
    expect(getGiftTokenStatus(tokenWith({}), 0)).toBe('available');
  });

  it('returns fully_redeemed when redemptionCount >= maxRedemptions', () => {
    expect(getGiftTokenStatus(tokenWith({ maxRedemptions: 1 }), 1)).toBe(
      'fully_redeemed'
    );
  });

  it('returns fully_redeemed for multi-use token at capacity', () => {
    expect(getGiftTokenStatus(tokenWith({ maxRedemptions: 5 }), 5)).toBe(
      'fully_redeemed'
    );
  });

  it('returns available for multi-use token with remaining redemptions', () => {
    expect(getGiftTokenStatus(tokenWith({ maxRedemptions: 5 }), 3)).toBe(
      'available'
    );
  });

  it('returns expired when expiresAt is in the past', () => {
    expect(
      getGiftTokenStatus(
        tokenWith({ expiresAt: new Date(Date.now() - 1000) }),
        0
      )
    ).toBe('expired');
  });

  it('fully_redeemed takes priority over expired', () => {
    expect(
      getGiftTokenStatus(
        tokenWith({
          maxRedemptions: 1,
          expiresAt: new Date(Date.now() - 1000),
        }),
        1
      )
    ).toBe('fully_redeemed');
  });
});

describe('redeemGiftToken', () => {
  beforeEach(() => {
    mockGiftTokenRows = [];
    mockRedemptionCountRows = [{ value: 0 }];
    mockInsertedValues = [];
    mockInsertReturning = [{ id: 'r-new' }];
    selectCallCount = 0;
    selectChain = createSelectChain();
    insertChain = createInsertChain();

    mockDb.select = (...args: unknown[]) =>
      (selectChain.select as MockFn)(...args);
    mockDb.insert = (...args: unknown[]) =>
      (insertChain.insert as MockFn)(...args);
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

  it('throws on fully redeemed code', async () => {
    mockGiftTokenRows = [
      {
        id: 'gt-1',
        code: 'HK7NWE',
        amountMicros: 10,
        maxRedemptions: 1,
        expiresAt: null,
      },
    ];
    mockRedemptionCountRows = [{ value: 1 }];
    try {
      await redeemGiftToken({
        code: 'HK7NWE',
        teamId: 'team-1',
        userId: 'user-1',
      });
      throw new Error('Expected error');
    } catch (err) {
      expect((err as Error).message).toBe(
        'This gift code has been fully redeemed'
      );
    }
  });

  it('throws when team already redeemed', async () => {
    mockGiftTokenRows = [
      {
        id: 'gt-1',
        code: 'HK7NWE',
        amountMicros: 10,
        maxRedemptions: 5,
        expiresAt: null,
      },
    ];
    mockRedemptionCountRows = [{ value: 2 }];
    mockInsertReturning = []; // Conflict → insert is a no-op
    try {
      await redeemGiftToken({
        code: 'HK7NWE',
        teamId: 'team-1',
        userId: 'user-1',
      });
      throw new Error('Expected error');
    } catch (err) {
      expect((err as Error).message).toBe(
        'Your team has already redeemed this gift code'
      );
    }
  });

  it('throws on expired code', async () => {
    mockGiftTokenRows = [
      {
        id: 'gt-1',
        code: 'HK7NWE',
        amountMicros: 10,
        maxRedemptions: 1,
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
