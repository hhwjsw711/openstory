/**
 * Mock for @fal-ai/client used in motion service tests
 */
import { mock } from 'bun:test';

export const mockSubscribe = mock();
export const mockFalClient = {
  subscribe: mockSubscribe,
  queue: {},
  realtime: {},
  storage: {},
  streaming: {},
  run: mock(),
  stream: mock(),
};

export const mockCreateFalClient = mock(() => mockFalClient);

// Mock the module
void mock.module('@fal-ai/client', () => ({
  createFalClient: mockCreateFalClient,
  QueueStatus: {},
  RequestLog: {},
}));
