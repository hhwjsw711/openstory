import { describe, expect, it, mock, beforeEach, spyOn } from 'bun:test';

// --- Mocks ---

const mockEnv = {
  OPENROUTER_KEY: 'platform-openrouter-key',
  FAL_KEY: 'platform-fal-key',
  API_KEY_ENCRYPTION_KEY: 'test-secret',
};

mock.module('#env', () => ({
  getEnv: () => mockEnv,
}));

// Chainable Drizzle-like mock
let mockDbRows: Record<string, unknown>[] = [];

function createChainableMock() {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'from', 'where', 'limit']) {
    chain[method] = mock(() => chain);
  }
  // Terminal: `limit` resolves to mockDbRows
  chain.limit = mock(() => mockDbRows);
  return chain;
}

let mockChain = createChainableMock();

mock.module('#db-client', () => ({
  getDb: () => mockChain,
}));

const { encryptApiKey } = await import('@/lib/crypto/api-key-encryption');
const { apiKeyService } = await import('./api-key.service');

// --- Tests ---

describe('apiKeyService.resolveKey', () => {
  beforeEach(() => {
    mockDbRows = [];
    mockChain = createChainableMock();
    // Re-apply the db mock so the service picks up the fresh chain
    mock.module('#db-client', () => ({
      getDb: () => mockChain,
    }));

    // Restore platform keys
    mockEnv.OPENROUTER_KEY = 'platform-openrouter-key';
    mockEnv.FAL_KEY = 'platform-fal-key';
  });

  it('returns the team key when one exists in the DB', async () => {
    const encrypted = await encryptApiKey('my-team-openrouter-key');
    mockDbRows = [encrypted];

    const result = await apiKeyService.resolveKey('openrouter', 'team-1');
    expect(result).toEqual({ key: 'my-team-openrouter-key', source: 'team' });
  });

  it('falls back to platform openrouter key when no team key', async () => {
    mockDbRows = [];
    const result = await apiKeyService.resolveKey('openrouter', 'team-1');
    expect(result).toEqual({
      key: 'platform-openrouter-key',
      source: 'platform',
    });
  });

  it('falls back to platform fal key when no team key', async () => {
    mockDbRows = [];
    const result = await apiKeyService.resolveKey('fal', 'team-1');
    expect(result).toEqual({ key: 'platform-fal-key', source: 'platform' });
  });

  it('throws when no team key and no platform key', async () => {
    mockDbRows = [];
    mockEnv.OPENROUTER_KEY = '';
    expect(apiKeyService.resolveKey('openrouter', 'team-1')).rejects.toThrow(
      'No API key available for provider: openrouter'
    );
  });
});

describe('apiKeyService.validateKey', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it('returns valid for OpenRouter 200 response', async () => {
    spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 })
    );
    const result = await apiKeyService.validateKey('openrouter', 'sk-test');
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid for OpenRouter 401 response', async () => {
    spyOn(global, 'fetch').mockResolvedValue(
      new Response('unauthorized', { status: 401 })
    );
    const result = await apiKeyService.validateKey('openrouter', 'bad-key');
    expect(result).toEqual({
      valid: false,
      error: 'OpenRouter returned 401',
    });
  });

  it('returns valid for Fal 200 response', async () => {
    spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 })
    );
    const result = await apiKeyService.validateKey('fal', 'fal-test');
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid for Fal 401 response', async () => {
    spyOn(global, 'fetch').mockResolvedValue(
      new Response('unauthorized', { status: 401 })
    );
    const result = await apiKeyService.validateKey('fal', 'bad-key');
    expect(result).toEqual({ valid: false, error: 'Invalid Fal.ai API key' });
  });
});
