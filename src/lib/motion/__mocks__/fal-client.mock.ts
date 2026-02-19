/**
 * Mock for @tanstack/ai and @tanstack/ai-fal used in motion service tests
 */
import { mock } from 'bun:test';

export const mockGenerateVideo = mock();
export const mockGetVideoJobStatus = mock();
export const mockFalVideo = mock(() => ({
  kind: 'video',
  name: 'fal',
  model: 'mock-model',
}));

// Mock the TanStack AI module
void mock.module('@tanstack/ai', () => ({
  generateVideo: mockGenerateVideo,
  getVideoJobStatus: mockGetVideoJobStatus,
}));

// Mock the TanStack AI fal adapter module
void mock.module('@tanstack/ai-fal', () => ({
  falVideo: mockFalVideo,
  createFalVideo: mockFalVideo,
  falImage: mock(() => ({ kind: 'image', name: 'fal', model: 'mock-model' })),
  createFalImage: mock(() => ({
    kind: 'image',
    name: 'fal',
    model: 'mock-model',
  })),
}));
