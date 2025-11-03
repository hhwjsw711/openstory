/**
 * Test setup file
 * Loaded before all tests via bunfig.toml
 */

import { afterAll, afterEach, beforeAll } from 'bun:test';
import { server } from '@/lib/mocks/server';

// Enable API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

// Reset request handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
