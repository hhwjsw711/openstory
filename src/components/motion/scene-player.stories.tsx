import type { Meta, StoryObj } from '@storybook/react';
import type { Frame } from '@/types/database';
import { ScenePlayer } from './scene-player';

const meta: Meta<typeof ScenePlayer> = {
  title: 'Motion/ScenePlayer',
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
  metadata: {
    sceneId: 'scene-1',
    sceneNumber: 1,
    originalScript: {
      extract: 'Sample scene text',
      lineNumber: 1,
      dialogue: [],
    },
    metadata: {
      title: 'Opening Scene',
      durationSeconds: 5,
      location: 'Forest',
      timeOfDay: 'Dawn',
      storyBeat: 'Introduction',
    },
    selectedVariant: {
      cameraAngle: 'A1' as const,
      movementStyle: 'B1' as const,
      moodTreatment: 'C1' as const,
      rationale: 'Sample rationale',
    },
    prompts: {
      visual: {
        fullPrompt: 'Sample visual prompt',
        negativePrompt: '',
        components: {
          sceneDescription: 'Forest scene',
          subject: 'Character',
          environment: 'Forest',
          lighting: 'Dawn light',
          camera: 'Wide shot',
          composition: 'Centered',
          style: 'Cinematic',
          technical: 'High detail',
          atmosphere: 'Mysterious',
        },
        parameters: {
          dimensions: { width: 1280, height: 720, aspectRatio: '16:9' },
          quality: { steps: 30, guidance: 7.5 },
          control: 0.8,
        },
      },
      motion: {
        fullPrompt: 'Sample motion prompt',
        components: {
          cameraMovement: 'Slow pan',
          startPosition: 'Left',
          endPosition: 'Right',
          durationSeconds: 5,
          speed: 'slow',
          smoothness: 'smooth',
          subjectTracking: 'follow',
          equipment: 'slider',
        },
        parameters: {
          durationSeconds: 5,
          fps: 24,
          motionAmount: 0.5,
          cameraControl: 0.7,
        },
      },
    },
    continuity: {
      characterTags: ['hero'],
      environmentTag: 'forest',
      colorPalette: 'cool',
      lightingSetup: 'natural',
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock frames with scene metadata
const mockFrames: Frame[] = [
  {
    ...mockFrameBase,
    id: '1',
    orderIndex: 0,
    thumbnailUrl: 'https://picsum.photos/seed/scene1/1280/720',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailStatus: 'completed',
    videoStatus: 'completed',
    metadata: {
      ...mockFrameBase.metadata,
      sceneNumber: 1,
      metadata: { ...mockFrameBase.metadata.metadata, title: 'Opening Scene' },
    } as unknown as Frame['metadata'],
  },
  {
    ...mockFrameBase,
    id: '2',
    orderIndex: 1,
    thumbnailUrl: 'https://picsum.photos/seed/scene2/1280/720',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailStatus: 'completed',
    videoStatus: 'completed',
    metadata: {
      ...mockFrameBase.metadata,
      sceneNumber: 2,
      metadata: { ...mockFrameBase.metadata.metadata, title: 'The Journey' },
    } as unknown as Frame['metadata'],
  },
  {
    ...mockFrameBase,
    id: '3',
    orderIndex: 2,
    thumbnailUrl: 'https://picsum.photos/seed/scene3/1280/720',
    videoUrl: null,
    thumbnailStatus: 'completed',
    videoStatus: 'pending',
    metadata: {
      ...mockFrameBase.metadata,
      sceneNumber: 3,
      metadata: { ...mockFrameBase.metadata.metadata, title: 'Climax' },
    } as unknown as Frame['metadata'],
  },
];

// Note: This component now shows ALL frames with completed thumbnails, not just completed videos.
// Frames with pending/generating/failed video status show poster frame with status overlay.

export const WithMockSequence: Story = {
  args: {
    sequenceId: 'demo-sequence-123',
    frames: mockFrames,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sequential playback with mixed video states. Scene 1-2 play videos, Scene 3 shows pending overlay on poster frame. Navigate through scenes to see different states.',
      },
    },
  },
};

export const AllVideoStates: Story = {
  args: {
    sequenceId: 'video-states-demo',
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/state1/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Completed Video',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/state2/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Pending Video',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: 'https://picsum.photos/seed/state3/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'generating',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Generating Video',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '4',
        orderIndex: 3,
        thumbnailUrl: 'https://picsum.photos/seed/state4/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'failed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 4,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Failed Video',
          },
        } as unknown as Frame['metadata'],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows all possible video states: completed (plays video), pending (clock icon), generating (spinner), and failed (error icon). Navigate through scenes to see each state overlay.',
      },
    },
  },
};

export const OnlyPendingVideos: Story = {
  args: {
    sequenceId: 'pending-only',
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/pending1/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Pending Scene 1',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/pending2/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Pending Scene 2',
          },
        } as unknown as Frame['metadata'],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'All frames have completed thumbnails but pending videos. Shows how the player handles a sequence where no videos are ready yet.',
      },
    },
  },
};
