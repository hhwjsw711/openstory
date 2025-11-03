import { generateMockStyles } from '@/lib/mocks/data-generators';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/internal/test';
import { StyleCompactSelector } from './style-compact-selector';

const meta = {
  title: 'Components/Style/StyleCompactSelector',
  component: StyleCompactSelector,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StyleCompactSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockStyles = generateMockStyles(15);

export const Default: Story = {
  args: {
    styles: mockStyles,
    selectedStyleId: mockStyles[0].id,
    onStyleSelect: fn(),
  },
  render: () => {
    const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
      mockStyles[0].id
    );

    return (
      <StyleCompactSelector
        styles={mockStyles}
        selectedStyleId={selectedStyleId}
        onStyleSelect={setSelectedStyleId}
      />
    );
  },
};
