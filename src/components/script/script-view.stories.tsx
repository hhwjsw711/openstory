import type { Meta, StoryObj } from '@storybook/nextjs';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScriptView } from './script-view';

// Create a new QueryClient for each story to avoid state leakage
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const meta: Meta<typeof ScriptView> = {
  title: 'Views/ScriptView',
  component: ScriptView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The complete new sequence creation page with all sections integrated.',
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  argTypes: {
    teamId: {
      description: 'The ID of the team to create the sequence for',
      control: 'text',
    },
    sequenceId: {
      description: 'The ID of the sequence to edit',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScriptView>;

export const Default: Story = {
  args: {
    teamId: 'demo-team',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default script view showing the complete user flow from script writing to storyboard generation.',
      },
    },
  },
};
