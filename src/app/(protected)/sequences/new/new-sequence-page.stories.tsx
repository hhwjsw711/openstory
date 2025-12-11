import type { Meta, StoryObj } from '@storybook/nextjs';
import NewSequencePage from './page';

const meta: Meta<typeof NewSequencePage> = {
  title: 'Pages/NewSequencePage',
  component: NewSequencePage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The complete new sequence creation page with all sections integrated.',
      },
    },
  },
  decorators: [(Story) => <Story />],
  argTypes: {
    searchParams: {
      description: 'URL search parameters including optional teamId',
      control: 'object',
    },
  },
};

export default meta;
type Story = StoryObj<typeof NewSequencePage>;

export const Default: Story = {
  args: {
    searchParams: {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default new sequence page showing the complete user flow from script writing to storyboard generation.',
      },
    },
  },
};

export const WithTeamId: Story = {
  args: {
    searchParams: {
      teamId: 'demo-team',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'New sequence page configured for a specific team with team-specific styles.',
      },
    },
  },
};
