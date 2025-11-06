import type { Meta, StoryObj } from '@storybook/react';
import { VidstackTimelineScrubber } from './vidstack-timeline-scrubber';

const meta: Meta<typeof VidstackTimelineScrubber> = {
  title: 'Scenes/VidstackTimelineScrubber',
  component: VidstackTimelineScrubber,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto p-8 bg-black/80 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VidstackTimelineScrubber>;

// Mock durations for 8 scenes (varying lengths)
const mockDurations = {
  0: 4.5,
  1: 5.2,
  2: 3.8,
  3: 6.1,
  4: 4.0,
  5: 5.5,
  6: 4.3,
  7: 5.0,
};

export const Beginning: Story = {
  args: {
    currentSceneIndex: 0,
    totalScenes: 8,
    frameDurations: mockDurations,
    currentVideoTime: 0,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};

export const Middle: Story = {
  args: {
    currentSceneIndex: 3,
    totalScenes: 8,
    frameDurations: mockDurations,
    currentVideoTime: 2.5,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};

export const End: Story = {
  args: {
    currentSceneIndex: 7,
    totalScenes: 8,
    frameDurations: mockDurations,
    currentVideoTime: 4.8,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};

export const WithoutDurations: Story = {
  args: {
    currentSceneIndex: 3,
    totalScenes: 8,
    frameDurations: {}, // Empty - will use 3s fallback
    currentVideoTime: 1.5,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};

export const FewScenes: Story = {
  args: {
    currentSceneIndex: 1,
    totalScenes: 3,
    frameDurations: {
      0: 5.0,
      1: 4.5,
      2: 6.0,
    },
    currentVideoTime: 2.0,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};

export const ManyScenes: Story = {
  args: {
    currentSceneIndex: 8,
    totalScenes: 15,
    frameDurations: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [i, 3.5 + Math.random() * 3])
    ),
    currentVideoTime: 1.8,
    onSeek: (sceneIndex, timeInScene) =>
      console.log(`Seek to scene ${sceneIndex} at ${timeInScene.toFixed(1)}s`),
  },
};
