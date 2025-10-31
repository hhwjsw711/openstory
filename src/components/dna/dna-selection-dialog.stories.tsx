import { Button } from '@/components/ui/button';
import { MOCK_SYSTEM_STYLES } from '@/lib/style/style-templates';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { DnaSelectionDialog } from './dna-selection-dialog';

const meta: Meta<typeof DnaSelectionDialog> = {
  title: 'Components/DNA/DnaSelectionDialog',
  component: DnaSelectionDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "A full-featured dialog for browsing and selecting Director's DNA (visual styles) with search, category filters, and responsive grid layout.",
      },
    },
  },
  argTypes: {
    open: {
      description: 'Whether the dialog is open',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback fired when dialog open state changes',
      action: 'dialog state changed',
    },
    selectedStyleId: {
      description: 'ID of the currently selected style',
      control: 'text',
    },
    onStyleSelect: {
      description: 'Callback fired when a style is selected',
      action: 'style selected',
    },
  },
};

export default meta;
type Story = StoryObj<typeof DnaSelectionDialog>;

// Interactive wrapper for stories
function InteractiveDnaDialog(
  props: Partial<React.ComponentProps<typeof DnaSelectionDialog>> & {
    initialSelectedId?: string | null;
  }
) {
  const { initialSelectedId = null, ...otherProps } = props;
  const [open, setOpen] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
    initialSelectedId
  );

  const handleReopen = () => {
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {!open && (
        <Button onClick={handleReopen}>Open Director's DNA Dialog</Button>
      )}
      <DnaSelectionDialog
        open={open}
        onOpenChange={setOpen}
        selectedStyleId={selectedStyleId}
        onStyleSelect={setSelectedStyleId}
        {...otherProps}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    docs: {
      description: {
        story:
          'Default DNA selection dialog with search, category filters, and style grid. Click on any style to select it.',
      },
    },
  },
};

export const WithPreselection: Story = {
  render: () => (
    <InteractiveDnaDialog initialSelectedId={MOCK_SYSTEM_STYLES[2].id} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Dialog with a pre-selected style showing the selected state with checkmark overlay.',
      },
    },
  },
};

export const EmptyState: Story = {
  render: () => {
    const EmptyWrapper = () => {
      const [open, setOpen] = useState(true);
      const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
        null
      );

      return (
        <div>
          {!open && <Button onClick={() => setOpen(true)}>Reopen</Button>}
          <DnaSelectionDialog
            open={open}
            onOpenChange={setOpen}
            selectedStyleId={selectedStyleId}
            onStyleSelect={setSelectedStyleId}
          />
        </div>
      );
    };

    return <EmptyWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dialog showing empty state when no styles match the current search/filter criteria.',
      },
    },
  },
};

export const SearchFunctionality: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the search functionality. Try searching for "cinematic", "anime", or "watercolor" to filter styles.',
      },
    },
  },
};

export const CategoryFilters: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    docs: {
      description: {
        story:
          'Shows the category filter chips. Click different categories to filter styles (All, New, TikTok Core, etc.).',
      },
    },
  },
};

export const MobileView: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story:
          'Dialog optimized for mobile devices with responsive grid layout (2 columns on small screens).',
      },
    },
  },
};

export const TabletView: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Dialog on tablet-sized screens showing 3-4 column grid layout.',
      },
    },
  },
};

export const DesktopView: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    docs: {
      description: {
        story:
          'Full desktop view with 5-column grid layout for browsing many styles.',
      },
    },
  },
};

export const InteractionFlow: Story = {
  render: () => {
    const InteractionDemo = () => {
      const [open, setOpen] = useState(false);
      const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
        null
      );

      const selectedStyle = MOCK_SYSTEM_STYLES.find(
        (style) => style.id === selectedStyleId
      );

      return (
        <div className="flex flex-col gap-4 p-8">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Current Selection:</h3>
            {selectedStyle ? (
              <div className="p-4 border rounded-lg">
                <p className="font-medium">{selectedStyle.name}</p>
                {selectedStyle.config &&
                typeof selectedStyle.config === 'object' &&
                'artStyle' in selectedStyle.config ? (
                  <p className="text-sm text-muted-foreground">
                    {String(selectedStyle.config.artStyle)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">No style selected</p>
            )}
          </div>

          <Button onClick={() => setOpen(true)}>Choose Director's DNA</Button>

          <DnaSelectionDialog
            open={open}
            onOpenChange={setOpen}
            selectedStyleId={selectedStyleId}
            onStyleSelect={setSelectedStyleId}
          />
        </div>
      );
    };

    return <InteractionDemo />;
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Complete interaction flow showing how to trigger the dialog with a button and display the selected style.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => <InteractiveDnaDialog />,
  parameters: {
    docs: {
      description: {
        story:
          'Dialog with full keyboard navigation support. Use Tab to navigate between styles, Enter/Space to select, and Escape to close.',
      },
    },
  },
};

export const LoadingState: Story = {
  render: () => {
    const LoadingWrapper = () => {
      const [open, setOpen] = useState(true);

      return (
        <div>
          {!open && <Button onClick={() => setOpen(true)}>Reopen</Button>}
          <DnaSelectionDialog
            open={open}
            onOpenChange={setOpen}
            selectedStyleId={null}
            onStyleSelect={() => {}}
          />
        </div>
      );
    };

    return <LoadingWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dialog showing loading skeletons while styles are being fetched from the API.',
      },
    },
  },
};
