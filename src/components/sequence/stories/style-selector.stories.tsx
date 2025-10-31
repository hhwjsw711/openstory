import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { generateMockStyles } from '@/lib/mocks/data-generators';
import { StyleSelector } from '../style-selector';

const meta: Meta<typeof StyleSelector> = {
  title: 'Components/Sequence/StyleSelector',
  component: StyleSelector,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A component for selecting visual styles from a collection of style presets, displaying style previews with color palettes and metadata.',
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
      description: 'Array of available styles to choose from',
      control: false,
    },
    disabled: {
      description: 'Whether the selector is disabled',
      control: 'boolean',
    },
    loading: {
      description: 'Whether to show loading skeleton',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StyleSelector>;

// Mock data - generate styles with realistic DNA-based configs
const mockStyles = generateMockStyles(12);

// Interactive wrapper for stories that need selection state
function InteractiveStyleSelector(
  props: Omit<
    React.ComponentProps<typeof StyleSelector>,
    'selectedStyleId' | 'onStyleSelect'
  > & {
    initialSelectedId?: string | null;
  }
) {
  const { initialSelectedId = null, ...otherProps } = props;
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
    initialSelectedId
  );

  return (
    <StyleSelector
      selectedStyleId={selectedStyleId}
      onStyleSelect={setSelectedStyleId}
      {...otherProps}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveStyleSelector styles={mockStyles} />,
};

export const WithSelection: Story = {
  render: () => (
    <InteractiveStyleSelector
      styles={mockStyles}
      initialSelectedId={mockStyles[2].id}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector with a pre-selected style showing visual feedback.',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    styles: [],
    loading: true,
    selectedStyleId: null,
    onStyleSelect: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector showing loading skeletons while styles are being fetched.',
      },
    },
  },
};

export const EmptyState: Story = {
  args: {
    styles: [],
    loading: false,
    selectedStyleId: null,
    onStyleSelect: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector showing empty state when no styles are available.',
      },
    },
  },
};

export const Disabled: Story = {
  render: () => (
    <InteractiveStyleSelector
      styles={mockStyles.slice(0, 6)}
      disabled
      initialSelectedId={mockStyles[1].id}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector in disabled state with reduced opacity and no interaction.',
      },
    },
  },
};

export const SmallCollection: Story = {
  render: () => <InteractiveStyleSelector styles={mockStyles.slice(0, 3)} />,
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector with only a few styles, showing responsive grid behavior.',
      },
    },
  },
};

export const LargeCollection: Story = {
  render: () => (
    <InteractiveStyleSelector
      styles={[
        ...mockStyles,
        ...mockStyles.map((s) => ({
          ...s,
          id: `${s.id}-2`,
          name: `${s.name} v2`,
        })),
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector with many styles demonstrating scrollable grid layout.',
      },
    },
  },
};

export const ResponsiveLayout: Story = {
  render: () => (
    <div className="max-w-7xl mx-auto">
      <InteractiveStyleSelector styles={mockStyles} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'StyleSelector demonstrating responsive grid layout behavior at different screen sizes.',
      },
    },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },
  },
};

export const StyleCategories: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Cinematic Styles</h3>
        <InteractiveStyleSelector
          styles={mockStyles.filter((s) =>
            ['cinematic', 'noir', 'documentary', 'horror'].includes(
              s.category ?? ''
            )
          )}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Artistic Styles</h3>
        <InteractiveStyleSelector
          styles={mockStyles.filter((s) => s.category === 'artistic')}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Modern & Stylized</h3>
        <InteractiveStyleSelector
          styles={mockStyles.filter((s) =>
            ['scifi', 'animation'].includes(s.category ?? '')
          )}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'StyleSelector organized by categories, showing different visual style groups for video generation.',
      },
    },
  },
};

export const PopularStyles: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Popular Styles</h2>
        <p className="text-muted-foreground">
          Most used styles by our community
        </p>
      </div>
      <InteractiveStyleSelector
        styles={mockStyles.slice(0, 6)}
        initialSelectedId={mockStyles[0].id}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A curated selection of the most popular styles, pre-selected with the first style.',
      },
    },
  },
};
