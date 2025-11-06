import type { Meta, StoryObj } from '@storybook/react';
import type { Frame } from '@/types/database';
import { ScenePreview } from './scene-preview';

const meta: Meta<typeof ScenePreview> = {
  title: 'Scenes/ScenePreview',
  component: ScenePreview,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ScenePreview>;

const mockFrameBase = {
  id: '1',
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

export const WithImage: Story = {
  args: {
    frame: {
      ...mockFrameBase,
      thumbnailUrl: 'https://picsum.photos/1280/720',
      videoUrl: null,
      thumbnailStatus: 'completed',
      videoStatus: 'pending',
    } as Frame,
  },
};

export const WithVideo: Story = {
  args: {
    frame: {
      ...mockFrameBase,
      thumbnailUrl: 'https://picsum.photos/1280/720',
      videoUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailStatus: 'completed',
      videoStatus: 'completed',
    } as Frame,
    isPlaying: true,
  },
};

export const WithVideoPaused: Story = {
  args: {
    frame: {
      ...mockFrameBase,
      thumbnailUrl: 'https://picsum.photos/1280/720',
      videoUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailStatus: 'completed',
      videoStatus: 'completed',
    } as Frame,
    isPlaying: false,
  },
};

export const Loading: Story = {
  args: {
    frame: null,
  },
};

export const Generating: Story = {
  args: {
    frame: {
      ...mockFrameBase,
      thumbnailUrl: null,
      videoUrl: null,
      thumbnailStatus: 'generating',
      videoStatus: 'pending',
    } as Frame,
  },
};
