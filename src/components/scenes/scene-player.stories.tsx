import type { Meta, StoryObj } from '@storybook/react';
import type { Frame } from '@/types/database';
import { ScenePlayer } from './scene-player';

const meta: Meta<typeof ScenePlayer> = {
  title: 'Scenes/ScenePlayer',
  component: ScenePlayer,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof ScenePlayer>;

const mockFrameBase = {
  sequenceId: 'seq-1',
  orderIndex: 0,
  description: 'A scene from the storyboard',
  durationMs: 5000,
  thumbnailWorkflowRunId: null,
  thumbnailGeneratedAt: null,
  thumbnailError: null,
  videoWorkflowRunId: null,
  videoGeneratedAt: null,
  videoError: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock frames with mix of images and videos
const mockFrames: Frame[] = [
  {
    ...mockFrameBase,
    id: '1',
    orderIndex: 0,
    thumbnailUrl: 'https://picsum.photos/seed/scene1/1280/720',
    videoUrl: null,
    thumbnailStatus: 'completed',
    videoStatus: 'pending',
  },
  {
    ...mockFrameBase,
    id: '2',
    orderIndex: 1,
    thumbnailUrl: 'https://picsum.photos/seed/scene2/1280/720',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailStatus: 'completed',
    videoStatus: 'completed',
  },
  {
    ...mockFrameBase,
    id: '3',
    orderIndex: 2,
    thumbnailUrl: 'https://picsum.photos/seed/scene3/1280/720',
    videoUrl: null,
    thumbnailStatus: 'completed',
    videoStatus: 'pending',
  },
  {
    ...mockFrameBase,
    id: '4',
    orderIndex: 3,
    thumbnailUrl: 'https://picsum.photos/seed/scene4/1280/720',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailStatus: 'completed',
    videoStatus: 'completed',
  },
  {
    ...mockFrameBase,
    id: '5',
    orderIndex: 4,
    thumbnailUrl: 'https://picsum.photos/seed/scene5/1280/720',
    videoUrl: null,
    thumbnailStatus: 'completed',
    videoStatus: 'pending',
  },
];

export const MixedContent: Story = {
  args: {
    frames: mockFrames,
  },
};

const manyFrames: Frame[] = Array.from({ length: 10 }, (_, i) => ({
  ...mockFrameBase,
  id: `frame-${i}`,
  orderIndex: i,
  thumbnailUrl: `https://picsum.photos/seed/scene${i}/1280/720`,
  videoUrl:
    i % 3 === 0
      ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      : null,
  thumbnailStatus: 'completed',
  videoStatus: i % 3 === 0 ? 'completed' : 'pending',
}));

export const ManyScenes: Story = {
  args: {
    frames: manyFrames,
  },
};

export const AllVideos: Story = {
  args: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/v1/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/v2/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
      },
    ],
  },
};

export const AllImages: Story = {
  args: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/img1/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/img2/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: 'https://picsum.photos/seed/img3/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
      },
    ],
  },
};
