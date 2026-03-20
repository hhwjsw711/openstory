import { mock } from 'bun:test';

// Import real exports before mock.module so they can be re-exported
import * as tanstackAi from '@tanstack/ai';

export const mockGenerateVideo = mock();
export const mockGetVideoJobStatus = mock();
export const mockFalVideo = mock(() => ({
  kind: 'video',
  name: 'fal',
  model: 'mock-model',
}));

void mock.module('@tanstack/ai', () => ({
  ...tanstackAi,
  generateVideo: mockGenerateVideo,
  getVideoJobStatus: mockGetVideoJobStatus,
}));

import * as tanstackAiFal from '@tanstack/ai-fal';

void mock.module('@tanstack/ai-fal', () => ({
  ...tanstackAiFal,
  falVideo: mockFalVideo,
  falImage: mock(() => ({ kind: 'image', name: 'fal', model: 'mock-model' })),
}));
