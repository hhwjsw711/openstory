import type { Meta, StoryObj } from '@storybook/react';
import { VideoStateOverlay } from './video-state-overlay';

const meta = {
  title: 'Motion/VideoStateOverlay',
  component: VideoStateOverlay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative aspect-video w-[640px]">
        {/* Mock poster frame background */}
        <div className="absolute inset-0 bg-linear-to-br from-purple-500 to-pink-500" />
        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-6xl font-bold">
          POSTER FRAME
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VideoStateOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GeneratingFrame: Story = {
  args: {
    thumbnailStatus: 'generating',
    videoStatus: 'pending',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows when the frame (thumbnail) is still being generated. Video generation will start after frame is ready.',
      },
    },
  },
};

export const GeneratingVideo: Story = {
  args: {
    thumbnailStatus: 'completed',
    videoStatus: 'generating',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows when the frame is ready but video is actively generating.',
      },
    },
  },
};

export const PendingVideo: Story = {
  args: {
    thumbnailStatus: 'completed',
    videoStatus: 'pending',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows when frame is ready and video generation will start automatically. Displays "Generating video..." since it will begin soon.',
      },
    },
  },
};

export const Failed: Story = {
  args: {
    thumbnailStatus: 'completed',
    videoStatus: 'failed',
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows error state when video generation failed.',
      },
    },
  },
};

export const Completed: Story = {
  args: {
    thumbnailStatus: 'completed',
    videoStatus: 'completed',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Completed status shows no overlay (returns null). Video will play normally.',
      },
    },
  },
};
