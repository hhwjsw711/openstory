/**
 * Mock for @tanstack/ai, @tanstack/ai-fal, and fal cost used in motion service tests
 */
import { mock } from 'bun:test';
import { IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';

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

// Mock fal cost calculation — uses the hardcoded model prices so existing test assertions hold
void mock.module('@/lib/ai/fal-cost', () => ({
  calculateFalCost: mock(
    async (endpointId: string, quantity: number): Promise<number> => {
      // Look up the model's hardcoded price to match test expectations
      const model = Object.values(IMAGE_TO_VIDEO_MODELS).find(
        (m) => m.id === endpointId
      );
      const pricePerSecond = model?.pricing.pricePerSecond ?? 0;
      return pricePerSecond * quantity;
    }
  ),
}));
