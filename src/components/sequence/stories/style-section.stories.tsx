import { MOCK_SYSTEM_STYLES } from '@/lib/style/style-templates';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { StyleSection } from '../style-section';

// Mock styles data for stories
const mockStyles = MOCK_SYSTEM_STYLES;

const meta: Meta<typeof StyleSection> = {
  title: 'Components/Sequence/StyleSection',
  component: StyleSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A section component containing the style selector with title and description.',
      },
    },
  },
  argTypes: {
    selectedStyleId: {
      description: 'ID of the currently selected style',
      control: 'text',
    },
    onStyleSelect: {
      description: 'Callback fired when a style is selected',
      action: 'style selected',
    },
    styles: {
      description: 'Array of available styles',
      control: 'object',
    },
    loading: {
      description: 'Whether styles are currently loading',
      control: 'boolean',
    },
    error: {
      description: 'Whether there was an error loading styles',
      control: 'boolean',
    },
    disabled: {
      description: 'Whether the style selector is disabled',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StyleSection>;

export const StyleSectionWithStyles: Story = {
  args: {
    selectedStyleId: null,
    styles: mockStyles,
    loading: false,
    error: false,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section with available styles to choose from.',
      },
    },
  },
};

export const StyleSectionWithSelectedStyle: Story = {
  args: {
    selectedStyleId: 'style-2',
    styles: mockStyles,
    loading: false,
    error: false,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section with a pre-selected style.',
      },
    },
  },
};

export const StyleSectionLoading: Story = {
  args: {
    selectedStyleId: null,
    styles: [],
    loading: true,
    error: false,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section in loading state showing skeleton placeholders.',
      },
    },
  },
};

export const StyleSectionError: Story = {
  args: {
    selectedStyleId: null,
    styles: [],
    loading: false,
    error: true,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section showing an error state when styles fail to load.',
      },
    },
  },
};

export const StyleSectionEmpty: Story = {
  args: {
    selectedStyleId: null,
    styles: [],
    loading: false,
    error: false,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section with no available styles.',
      },
    },
  },
};

export const StyleSectionDisabled: Story = {
  args: {
    selectedStyleId: 'style-1',
    styles: mockStyles,
    loading: false,
    error: false,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Style section in disabled state during form submission.',
      },
    },
  },
};
