import { mock } from 'bun:test';

export const mockGenerateVideo = mock();
export const mockGetVideoJobStatus = mock();
export const mockFalVideo = mock(() => ({
  kind: 'video',
  name: 'fal',
  model: 'mock-model',
}));

void mock.module('@tanstack/ai', () => ({
  generateVideo: mockGenerateVideo,
  getVideoJobStatus: mockGetVideoJobStatus,
}));

void mock.module('@tanstack/ai-fal', () => ({
  falVideo: mockFalVideo,
  falImage: mock(() => ({ kind: 'image', name: 'fal', model: 'mock-model' })),
}));
