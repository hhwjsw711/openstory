import { ScenesView } from '@/components/views/scenes-view';
import type { Frame } from '@/types/database';
import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Extend the component props to include frames for story mocking
// Frames are passed through parameters, not args, so make them optional
type ScenesViewStoryProps = React.ComponentProps<typeof ScenesView> & {
  frames?: Frame[];
};

const meta = {
  title: 'Views/Scenes',
  component: ScenesView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story, context) => {
      // Get frames from story parameters (not args since ScenesView doesn't accept them)
      const frames = (context.parameters.frames as Frame[]) || [];
      const sequenceId = context.args.sequenceId || 'mock-sequence';

      // Create a query client with mock data
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      // Pre-populate the cache with mock frame data using the correct query key
      queryClient.setQueryData(['frames', 'list', sequenceId], frames);

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<ScenesViewStoryProps>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock frame base
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

export const MixedStates: Story = {
  args: {
    sequenceId: 'demo-sequence-123',
  },
  parameters: {
    frames: [
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
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Opening Scene',
          },
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
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'The Journey',
          },
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
      {
        ...mockFrameBase,
        id: '4',
        orderIndex: 3,
        thumbnailUrl: 'https://picsum.photos/seed/scene4/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'generating',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 4,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Resolution',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '5',
        orderIndex: 4,
        thumbnailUrl: null,
        videoUrl: null,
        thumbnailStatus: 'generating',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 5,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Epilogue',
          },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'Full scenes page with mixed states. Scenes 1-2 have completed videos and play normally. Scene 3 shows "Generating video..." overlay. Scene 4 is generating video. Scene 5 is still generating its frame (appears in list but not player).',
      },
    },
  },
};

export const AllCompleted: Story = {
  args: {
    sequenceId: 'all-completed',
  },
  parameters: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/complete1/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: { ...mockFrameBase.metadata.metadata, title: 'Scene 1' },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/complete2/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: { ...mockFrameBase.metadata.metadata, title: 'Scene 2' },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: 'https://picsum.photos/seed/complete3/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: { ...mockFrameBase.metadata.metadata, title: 'Scene 3' },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'All scenes have completed videos. Demonstrates sequential playback of multiple videos. Videos will auto-advance from one to the next.',
      },
    },
  },
};

export const AllPending: Story = {
  args: {
    sequenceId: 'all-pending',
  },
  parameters: {
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
            title: 'Waiting for Video 1',
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
            title: 'Waiting for Video 2',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: 'https://picsum.photos/seed/pending3/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Waiting for Video 3',
          },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'All scenes have thumbnails but are waiting for video generation. Player shows pending overlay on each scene.',
      },
    },
  },
};

export const FramesGenerating: Story = {
  args: {
    sequenceId: 'frames-generating',
  },
  parameters: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/framegen1/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Scene 1 - Ready',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/framegen2/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Scene 2 - Frame Ready',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: null,
        videoUrl: null,
        thumbnailStatus: 'generating',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Scene 3 - Generating Frame',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '4',
        orderIndex: 3,
        thumbnailUrl: null,
        videoUrl: null,
        thumbnailStatus: 'pending',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 4,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Scene 4 - Frame Pending',
          },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'Shows frames at different stages of generation. Scene 1 is complete and playable. Scene 2 has frame ready, shows "Generating video..." in player. Scenes 3-4 are generating/pending frames (visible in list with skeleton, not in player).',
      },
    },
  },
};

export const GenerationInProgress: Story = {
  args: {
    sequenceId: 'generating',
  },
  parameters: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/gen1/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'generating',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Video Generating',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: null,
        videoUrl: null,
        thumbnailStatus: 'generating',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Frame Generating',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: null,
        videoUrl: null,
        thumbnailStatus: 'pending',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Frame Pending',
          },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'Multiple scenes in generation. Scene 1 shows "Generating video..." in player. Scenes 2-3 are generating/pending frames (visible in list only, not player).',
      },
    },
  },
};

export const WithFailures: Story = {
  args: {
    sequenceId: 'with-failures',
  },
  parameters: {
    frames: [
      {
        ...mockFrameBase,
        id: '1',
        orderIndex: 0,
        thumbnailUrl: 'https://picsum.photos/seed/fail1/1280/720',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailStatus: 'completed',
        videoStatus: 'completed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 1,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Successful Scene',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '2',
        orderIndex: 1,
        thumbnailUrl: 'https://picsum.photos/seed/fail2/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'failed',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 2,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Failed Generation',
          },
        } as unknown as Frame['metadata'],
      },
      {
        ...mockFrameBase,
        id: '3',
        orderIndex: 2,
        thumbnailUrl: 'https://picsum.photos/seed/fail3/1280/720',
        videoUrl: null,
        thumbnailStatus: 'completed',
        videoStatus: 'pending',
        metadata: {
          ...mockFrameBase.metadata,
          sceneNumber: 3,
          metadata: {
            ...mockFrameBase.metadata.metadata,
            title: 'Pending Scene',
          },
        } as unknown as Frame['metadata'],
      },
    ],
    docs: {
      description: {
        story:
          'Demonstrates error handling. Scene 1 plays normally, Scene 2 shows failed state with error icon, Scene 3 is pending.',
      },
    },
  },
};

export const EmptySequence: Story = {
  args: {
    sequenceId: 'empty-sequence',
  },
  parameters: {
    frames: [],
    docs: {
      description: {
        story:
          'Empty sequence with no frames. Shows how the page handles sequences without any scenes.',
      },
    },
  },
};
