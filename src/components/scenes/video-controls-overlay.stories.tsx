import type { Meta, StoryObj } from '@storybook/react';
import { VideoControlsOverlay } from './video-controls-overlay';

const meta: Meta<typeof VideoControlsOverlay> = {
  title: 'Scenes/VideoControlsOverlay',
  component: VideoControlsOverlay,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl mx-auto p-8 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VideoControlsOverlay>;

export const Playing: Story = {
  args: {
    isPlaying: true,
    currentSceneIndex: 2,
    totalScenes: 8,
    currentTime: 6,
    totalTime: 24,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onPrevious: () => console.log('Previous clicked'),
    onNext: () => console.log('Next clicked'),
  },
};

export const Paused: Story = {
  args: {
    isPlaying: false,
    currentSceneIndex: 0,
    totalScenes: 8,
    currentTime: 0,
    totalTime: 24,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onPrevious: () => console.log('Previous clicked'),
    onNext: () => console.log('Next clicked'),
  },
};

export const LastScene: Story = {
  args: {
    isPlaying: false,
    currentSceneIndex: 7,
    totalScenes: 8,
    currentTime: 21,
    totalTime: 24,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onPrevious: () => console.log('Previous clicked'),
    onNext: () => console.log('Next clicked'),
  },
};

export const LongSequence: Story = {
  args: {
    isPlaying: true,
    currentSceneIndex: 14,
    totalScenes: 25,
    currentTime: 45,
    totalTime: 75,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onPrevious: () => console.log('Previous clicked'),
    onNext: () => console.log('Next clicked'),
  },
};

export const ShortSequence: Story = {
  args: {
    isPlaying: false,
    currentSceneIndex: 1,
    totalScenes: 3,
    currentTime: 5,
    totalTime: 15,
    onPlayPause: () => console.log('Play/Pause clicked'),
    onPrevious: () => console.log('Previous clicked'),
    onNext: () => console.log('Next clicked'),
  },
};
