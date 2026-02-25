import { mock } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';

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

// Uses hardcoded model prices so existing test assertions hold
void mock.module('@/lib/ai/fal-cost', () => ({
  calculateFalCost: mock(async (endpointId: string, quantity: number) => {
    const model = Object.values(IMAGE_TO_VIDEO_MODELS).find(
      (m) => m.id === endpointId
    );
    return (model?.pricing.pricePerSecond ?? 0) * quantity;
  }),
}));
