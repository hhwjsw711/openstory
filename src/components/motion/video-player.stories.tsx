import type { Meta, StoryObj } from '@storybook/react';
import { VideoPlayer } from './video-player';

const meta: Meta<typeof VideoPlayer> = {
  title: 'Motion/VideoPlayer',
  component: VideoPlayer,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof VideoPlayer>;

export const SingleVideo: Story = {
  args: {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    posterSrc: 'https://picsum.photos/seed/poster/1280/720',
    aspectRatio: '16:9',
  },
};

export const WithoutPoster: Story = {
  args: {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    aspectRatio: '16:9',
  },
};

// Note: Chapters require a real VTT file. In production, this would come from the API.
// For now, this demonstrates the component structure. You can create a mock VTT file
// at public/mock-chapters.vtt to test chapter functionality in Storybook.
export const WithChapters: Story = {
  args: {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    chaptersUrl: '/mock-chapters.vtt', // Create this file in public/ to test
    posterSrc: 'https://picsum.photos/seed/chapters/1280/720',
    aspectRatio: '16:9',
  },
};

// Portrait aspect ratio
export const PortraitVideo: Story = {
  args: {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    posterSrc: 'https://picsum.photos/seed/portrait/720/1280',
    aspectRatio: '9:16',
  },
};

// Square aspect ratio
export const SquareVideo: Story = {
  args: {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    posterSrc: 'https://picsum.photos/seed/square/1280/1280',
    aspectRatio: '1:1',
  },
};
