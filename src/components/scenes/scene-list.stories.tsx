import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generateMockFrames } from '@/lib/mocks/data-generators';
import { SceneList } from './scene-list';

// Create a mock query client for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const meta: Meta<typeof SceneList> = {
  title: 'Scenes/SceneList',
  component: SceneList,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    sequenceId: 'mock-sequence-id',
    selectedFrameId: null,
    completedFrameIds: new Set<string>(),
    onSelectFrame: () => console.log('onSelectFrame'),
    onToggleComplete: () => console.log('onToggleComplete'),
  },
};

export default meta;
type Story = StoryObj<typeof SceneList>;

// Generate mock frames for different scenarios
const mockFrames = generateMockFrames(5, 'mock-sequence-id');

// Mock the API response
const mockFetchResponse = (frames: typeof mockFrames) => {
  const originalFetch = global.fetch;
  global.fetch = Object.assign(
    async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      if (urlString.includes('/frames')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: frames,
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({ success: false }),
      } as Response;
    },
    { preconnect: originalFetch.preconnect }
  );
};

export const WithScenes: Story = {
  args: {
    selectedFrameId: mockFrames[1]?.id ?? null,
    completedFrameIds: new Set([mockFrames[3]?.id ?? '']),
  },
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const NoSelectedScene: Story = {
  args: {
    selectedFrameId: null,
    completedFrameIds: new Set<string>(),
  },
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const MultipleCompleted: Story = {
  args: {
    selectedFrameId: mockFrames[0]?.id ?? null,
    completedFrameIds: new Set([
      mockFrames[0]?.id ?? '',
      mockFrames[2]?.id ?? '',
      mockFrames[4]?.id ?? '',
    ]),
  },
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const AllCompleted: Story = {
  args: {
    selectedFrameId: null,
    completedFrameIds: new Set(mockFrames.map((f) => f.id)),
  },
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const Empty: Story = {
  args: {
    selectedFrameId: null,
    completedFrameIds: new Set<string>(),
  },
  beforeEach: () => {
    mockFetchResponse([]);
  },
};

export const ManyScenes: Story = {
  args: {
    selectedFrameId: null,
    completedFrameIds: new Set<string>(),
  },
  beforeEach: () => {
    const manyFrames = generateMockFrames(15, 'mock-sequence-id');
    mockFetchResponse(manyFrames);
  },
};

export const GeneratingThumbnails: Story = {
  args: {
    selectedFrameId: mockFrames[0]?.id ?? null,
    completedFrameIds: new Set<string>(),
  },
  beforeEach: () => {
    const generatingFrames = mockFrames.map((frame, idx) => ({
      ...frame,
      thumbnailStatus:
        idx < 3 ? ('generating' as const) : ('completed' as const),
      thumbnailUrl: idx < 3 ? null : frame.thumbnailUrl,
    }));
    mockFetchResponse(generatingFrames);
  },
};

export const WithFailures: Story = {
  args: {
    selectedFrameId: null,
    completedFrameIds: new Set<string>(),
  },
  beforeEach: () => {
    const framesWithFailures = mockFrames.map((frame, idx) => ({
      ...frame,
      thumbnailStatus: idx === 2 ? ('failed' as const) : ('completed' as const),
      thumbnailUrl: idx === 2 ? null : frame.thumbnailUrl,
      thumbnailError: idx === 2 ? 'Generation timeout' : null,
    }));
    mockFetchResponse(framesWithFailures);
  },
};

export const MixedStates: Story = {
  args: {
    selectedFrameId: mockFrames[1]?.id ?? null,
    completedFrameIds: new Set([mockFrames[4]?.id ?? '']),
  },
  beforeEach: () => {
    const mixedFrames = mockFrames.map((frame, idx) => {
      if (idx === 0) {
        return {
          ...frame,
          thumbnailStatus: 'pending' as const,
          thumbnailUrl: null,
        };
      }
      if (idx === 1) {
        return {
          ...frame,
          thumbnailStatus: 'generating' as const,
          thumbnailUrl: null,
        };
      }
      if (idx === 2) {
        return {
          ...frame,
          thumbnailStatus: 'failed' as const,
          thumbnailUrl: null,
          thumbnailError: 'API error',
        };
      }
      return {
        ...frame,
        thumbnailStatus: 'completed' as const,
      };
    });
    mockFetchResponse(mixedFrames);
  },
};

// Width variations
export const WidthMedium: Story = {
  args: {
    selectedFrameId: mockFrames[1]?.id ?? null,
    completedFrameIds: new Set([mockFrames[3]?.id ?? '']),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen">
          <div className="[&>div]:w-96">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const WidthLarge: Story = {
  args: {
    selectedFrameId: mockFrames[1]?.id ?? null,
    completedFrameIds: new Set([mockFrames[3]?.id ?? '']),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen">
          <div className="[&>div]:w-[32rem]">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};

export const WidthExtraLarge: Story = {
  args: {
    selectedFrameId: mockFrames[1]?.id ?? null,
    completedFrameIds: new Set([mockFrames[3]?.id ?? '']),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen">
          <div className="[&>div]:w-[48rem]">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  beforeEach: () => {
    mockFetchResponse(mockFrames);
  },
};
