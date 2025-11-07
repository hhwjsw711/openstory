import type { Frame } from '@/types/database';
import type { Meta, StoryObj } from '@storybook/react';
import { SceneListItem } from './scene-list-item';

const mockFrame: Frame = {
  id: 'frame-1',
  sequenceId: 'seq-1',
  orderIndex: 0,
  description: 'A bustling coffee shop interior during morning rush hour',
  durationMs: 3000,
  thumbnailUrl: 'https://picsum.photos/seed/coffee/320/180',
  videoUrl: null,
  thumbnailStatus: 'completed',
  videoStatus: 'pending',
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
      extract:
        'INT. COFFEE SHOP - MORNING\n\nSARAH sits at a corner table, typing furiously on her laptop. Steam rises from her untouched latte.',
      lineNumber: 1,
      dialogue: [
        {
          character: 'SARAH',
          line: 'This deadline is going to kill me.',
        },
      ],
    },
    metadata: {
      title: 'Coffee Shop Introduction',
      durationSeconds: 3,
      location: 'Coffee Shop',
      timeOfDay: 'Morning',
      storyBeat: 'Establish protagonist stress and setting',
    },
    selectedVariant: {
      cameraAngle: 'A2' as const,
      movementStyle: 'B1' as const,
      moodTreatment: 'C1' as const,
      rationale: 'Selected for emotional impact',
    },
    prompts: {
      visual: {
        fullPrompt:
          'Busy coffee shop interior, morning light streaming through windows',
        negativePrompt: 'blurry, low quality',
        components: {
          sceneDescription: 'Coffee shop',
          subject: 'Woman at laptop',
          environment: 'Interior cafe',
          lighting: 'Natural morning light',
          camera: 'Medium shot',
          composition: 'Rule of thirds',
          style: 'Cinematic',
          technical: '4K, sharp focus',
          atmosphere: 'Bustling yet intimate',
        },
        parameters: {
          dimensions: {
            width: 1920,
            height: 1080,
            aspectRatio: '16:9',
          },
          quality: {
            steps: 30,
            guidance: 7.5,
          },
          control: {
            seed: null,
          },
        },
      },
      motion: {
        fullPrompt: 'Slow push in, subtle camera movement',
        components: {
          cameraMovement: 'Push in',
          startPosition: 'Wide',
          endPosition: 'Medium',
          durationSeconds: 3,
          speed: 'Slow',
          smoothness: 'Very smooth',
          subjectTracking: 'Locked',
          equipment: 'Dolly',
        },
        parameters: {
          durationSeconds: 3,
          fps: 24,
          motionAmount: 'medium' as const,
          cameraControl: {
            pan: 0,
            tilt: 0,
            zoom: 0.2,
            movement: 'forward',
          },
        },
      },
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const meta: Meta<typeof SceneListItem> = {
  title: 'Scenes/SceneListItem',
  component: SceneListItem,
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
  args: {
    onSelect: () => console.log('onSelect'),
  },
};

export default meta;
type Story = StoryObj<typeof SceneListItem>;

export const Inactive: Story = {
  args: {
    frame: mockFrame,
    isActive: false,
    isCompleted: false,
  },
};

export const Active: Story = {
  args: {
    frame: mockFrame,
    isActive: true,
    isCompleted: false,
  },
};

export const Completed: Story = {
  args: {
    frame: mockFrame,
    isActive: false,
    isCompleted: true,
  },
};

export const ActiveAndCompleted: Story = {
  args: {
    frame: mockFrame,
    isActive: true,
    isCompleted: true,
  },
};

export const Generating: Story = {
  args: {
    frame: {
      ...mockFrame,
      thumbnailUrl: null,
      thumbnailStatus: 'generating',
    },
    isActive: false,
    isCompleted: false,
  },
};

export const GeneratingActive: Story = {
  args: {
    frame: {
      ...mockFrame,
      thumbnailUrl: null,
      thumbnailStatus: 'generating',
    },
    isActive: true,
    isCompleted: false,
  },
};

export const Failed: Story = {
  args: {
    frame: {
      ...mockFrame,
      thumbnailUrl: null,
      thumbnailStatus: 'failed',
      thumbnailError: 'Generation timeout',
    },
    isActive: false,
    isCompleted: false,
  },
};

export const LongTitle: Story = {
  args: {
    frame: {
      ...mockFrame,
      metadata: {
        ...mockFrame.metadata,
        metadata: {
          ...mockFrame.metadata?.metadata,
          title:
            'An Extremely Long Scene Title That Should Wrap Properly Without Breaking Layout',
        },
      } as Frame['metadata'],
    },
    isActive: false,
    isCompleted: false,
  },
};

export const LongScript: Story = {
  args: {
    frame: {
      ...mockFrame,
      metadata: {
        ...mockFrame.metadata,
        originalScript: {
          ...(mockFrame.metadata?.originalScript ?? {
            extract: '',
            lineNumber: 0,
            dialogue: [],
          }),
          extract:
            'INT. COFFEE SHOP - MORNING\n\nSARAH sits at a corner table, typing furiously on her laptop. Steam rises from her untouched latte. The morning sun streams through large windows, casting long shadows across the wooden floor. Other patrons bustle about, ordering drinks and chatting, creating a backdrop of ambient noise that Sarah tries to tune out.',
        },
      } as Frame['metadata'],
    },
    isActive: false,
    isCompleted: false,
  },
};
