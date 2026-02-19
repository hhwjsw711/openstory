import type { Meta, StoryObj } from '@storybook/react';
import { SceneThumbnail } from './scene-thumbnail';

const meta: Meta<typeof SceneThumbnail> = {
  title: 'Scenes/SceneThumbnail',
  component: SceneThumbnail,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SceneThumbnail>;

export const Pending: Story = {
  args: {
    thumbnailStatus: 'pending',
    alt: 'Scene 1',
  },
};

export const Generating: Story = {
  args: {
    thumbnailStatus: 'generating',
    alt: 'Scene 1',
  },
};

export const Completed: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/scene1/320/180',
    thumbnailStatus: 'completed',
    alt: 'Scene 1',
  },
};

export const Failed: Story = {
  args: {
    thumbnailStatus: 'failed',
    alt: 'Scene 1',
  },
};

export const CompletedWithDifferentImage: Story = {
  args: {
    thumbnailUrl: 'https://picsum.photos/seed/scene2/320/180',
    thumbnailStatus: 'completed',
    alt: 'Scene 2 - Different composition',
  },
};
