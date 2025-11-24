import type { Meta, StoryObj } from '@storybook/react';
import { ScriptPrompt } from './script-prompt';

const meta = {
  title: 'Script/ScriptPrompt',
  component: ScriptPrompt,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a0a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
} satisfies Meta<typeof ScriptPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onGenerate: (script, aspectRatio, model) => {
      console.log('Generate:', { script, aspectRatio, model });
    },
    selectedStyle: {
      id: '1',
      name: 'Cinematic Drama',
      previewUrl:
        'https://assets.velro.ai/styles/cinematic-drama/character.jpg',
    },
    onStyleClick: () => {
      console.log('Style clicked');
    },
  },
};

export const WithoutStyle: Story = {
  args: {
    onGenerate: (script, aspectRatio, model) => {
      console.log('Generate:', { script, aspectRatio, model });
    },
  },
};

export const InContainer: Story = {
  args: {
    onGenerate: (script, aspectRatio, model) => {
      console.log('Generate:', { script, aspectRatio, model });
    },
    selectedStyle: {
      id: '2',
      name: 'Neo-Noir Thriller',
      previewUrl:
        'https://assets.velro.ai/styles/neo-noir-thriller/character.jpg',
    },
    onStyleClick: () => {
      console.log('Style clicked');
    },
  },
  render: (args) => {
    return (
      <div className="w-[1200px] p-8">
        <ScriptPrompt {...args} />
      </div>
    );
  },
};
