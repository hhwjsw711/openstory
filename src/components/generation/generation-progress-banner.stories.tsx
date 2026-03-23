import {
  createInitialState,
  type GenerationPhase,
  type GenerationStreamState,
} from '@/lib/realtime/generation-stream.reducer';
import type { Meta, StoryObj } from '@storybook/react';
import { GenerationProgressBanner } from './generation-progress-banner';

function makeState(
  overrides: Partial<GenerationStreamState> & { phases: GenerationPhase[] }
): GenerationStreamState {
  return {
    currentPhase: 0,
    scenes: [],
    frames: new Map(),
    isComplete: false,
    isFailed: false,
    talentMatches: [],
    locationMatches: [],
    unusedTalent: null,
    ...overrides,
  };
}

function withPhaseProgress(
  base: GenerationStreamState,
  activePhase: number
): GenerationStreamState {
  return {
    ...base,
    currentPhase: activePhase,
    phases: base.phases.map((p) => ({
      ...p,
      status:
        p.phase < activePhase
          ? 'completed'
          : p.phase === activePhase
            ? 'active'
            : 'pending',
    })),
  };
}

const sixPhases = createInitialState({
  autoGenerateMotion: false,
  autoGenerateMusic: false,
});

const sevenPhasesMotion = createInitialState({
  autoGenerateMotion: true,
  autoGenerateMusic: false,
});

const sevenPhasesMusic = createInitialState({
  autoGenerateMotion: false,
  autoGenerateMusic: true,
});

const sevenPhasesBoth = createInitialState({
  autoGenerateMotion: true,
  autoGenerateMusic: true,
});

const meta: Meta<typeof GenerationProgressBanner> = {
  title: 'Generation/GenerationProgressBanner',
  component: GenerationProgressBanner,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-6xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GenerationProgressBanner>;

// --- 6 phases (auto-generate off) ---

export const SixPhases_Phase1: Story = {
  name: '6 phases - Script analysis',
  args: {
    generationState: withPhaseProgress(sixPhases, 1),
    isProcessing: true,
    startedAt: new Date(),
  },
};

export const SixPhases_Phase3: Story = {
  name: '6 phases - Generating prompts',
  args: {
    generationState: withPhaseProgress(sixPhases, 3),
    isProcessing: true,
    startedAt: new Date(Date.now() - 60_000),
  },
};

export const SixPhases_Phase4: Story = {
  name: '6 phases - Generating images',
  args: {
    generationState: withPhaseProgress(sixPhases, 4),
    isProcessing: true,
    startedAt: new Date(Date.now() - 90_000),
  },
};

export const SixPhases_Phase6: Story = {
  name: '6 phases - Music design (last phase)',
  args: {
    generationState: withPhaseProgress(sixPhases, 6),
    isProcessing: true,
    startedAt: new Date(Date.now() - 120_000),
  },
};

// --- 7 phases (motion only) ---

export const SevenPhasesMotion_Phase4: Story = {
  name: '7 phases (motion) - Generating images',
  args: {
    generationState: withPhaseProgress(sevenPhasesMotion, 4),
    isProcessing: true,
    startedAt: new Date(Date.now() - 90_000),
  },
};

export const SevenPhasesMotion_Phase7: Story = {
  name: '7 phases (motion) - Motion video',
  args: {
    generationState: withPhaseProgress(sevenPhasesMotion, 7),
    isProcessing: true,
    startedAt: new Date(Date.now() - 150_000),
  },
};

// --- 7 phases (music only) ---

export const SevenPhasesMusic_Phase7: Story = {
  name: '7 phases (music) - Music generation',
  args: {
    generationState: withPhaseProgress(sevenPhasesMusic, 7),
    isProcessing: true,
    startedAt: new Date(Date.now() - 150_000),
  },
};

// --- 7 phases (both) ---

export const SevenPhasesBoth_Phase4: Story = {
  name: '7 phases (both) - Generating images',
  args: {
    generationState: withPhaseProgress(sevenPhasesBoth, 4),
    isProcessing: true,
    startedAt: new Date(Date.now() - 90_000),
  },
};

export const SevenPhasesBoth_Phase7: Story = {
  name: '7 phases (both) - Video & Music',
  args: {
    generationState: withPhaseProgress(sevenPhasesBoth, 7),
    isProcessing: true,
    startedAt: new Date(Date.now() - 150_000),
  },
};

// --- Edge cases ---

export const AllComplete: Story = {
  name: 'All phases complete (6 phases)',
  args: {
    generationState: makeState({
      ...sixPhases,
      currentPhase: 7,
      isComplete: true,
      phases: sixPhases.phases.map((p) => ({ ...p, status: 'completed' })),
    }),
    isProcessing: true,
    startedAt: new Date(Date.now() - 180_000),
  },
};

export const WithScenes: Story = {
  name: 'With streamed scenes',
  args: {
    generationState: {
      ...withPhaseProgress(sixPhases, 4),
      scenes: [
        {
          sceneId: 's1',
          sceneNumber: 1,
          title: 'Opening shot',
          scriptExtract: 'The camera pans across...',
          durationSeconds: 5,
        },
        {
          sceneId: 's2',
          sceneNumber: 2,
          title: 'Character introduction',
          scriptExtract: 'We see the protagonist...',
          durationSeconds: 8,
        },
        {
          sceneId: 's3',
          sceneNumber: 3,
          title: 'The conflict',
          scriptExtract: 'Tension rises as...',
          durationSeconds: 6,
        },
      ],
    },
    isProcessing: true,
    startedAt: new Date(Date.now() - 95_000),
    script:
      'A short film about a detective investigating a mysterious disappearance in a small coastal town. The opening shows the foggy harbor at dawn.',
  },
};
