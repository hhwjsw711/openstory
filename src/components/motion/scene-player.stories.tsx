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

// Note: This component uses sequential video playback - switching the video src when each video ends.
// No chapter navigation UI - just seamless video-to-video transitions.
//
// Scene 3 is intentionally set to "pending" status and will be skipped during playback.
// All other scenes use sample videos (Big Buck Bunny, Elephants Dream).

export const WithMockSequence: Story = {
  args: {
    sequenceId: 'demo-sequence-123',
    frames: mockFrames,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sequential video playback with Vidstack. The component automatically switches to the next video when each one ends. Scene 3 is skipped (pending status). No chapter navigation - just seamless transitions.',
      },
    },
  },
};

export const MultipleScenes: Story = {
  args: {
    sequenceId: 'multi-scene-demo',
    frames: mockFrames,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same demo but with different sequence ID. This shows how the component handles different sequences with seamless video transitions.',
      },
    },
  },
};
