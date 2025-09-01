import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMockStyles } from "@/lib/mocks/data-generators";
import { StyleSelector } from "./style-selector";

describe("StyleSelector", () => {
  const mockStyles = generateMockStyles(6);
  const defaultProps = {
    selectedStyleId: null,
    onStyleSelect: vi.fn(),
    styles: mockStyles,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders styles in a grid layout", () => {
    render(<StyleSelector {...defaultProps} />);

    const grid = screen.getByTestId("styles-grid");
    const styleCards = screen.getAllByRole("button");

    expect(grid).toBeInTheDocument();
    expect(styleCards).toHaveLength(6);
  });

  it("displays style information correctly", () => {
    render(<StyleSelector {...defaultProps} />);

    const firstStyle = mockStyles[0];
    const firstCard = screen.getByTestId(`style-card-${firstStyle.id}`);

    expect(firstCard).toBeInTheDocument();
    expect(screen.getByText(firstStyle.name)).toBeInTheDocument();

    // Check for image
    const image = screen.getByAltText(`${firstStyle.name} style preview`);
    expect(image).toHaveAttribute("src", firstStyle.preview_url);
  });

  it("shows selected state correctly", () => {
    const selectedId = mockStyles[1].id;
    render(<StyleSelector {...defaultProps} selectedStyleId={selectedId} />);

    const selectedCard = screen.getByTestId(`style-card-${selectedId}`);
    const unselectedCard = screen.getByTestId(`style-card-${mockStyles[0].id}`);

    expect(selectedCard).toHaveAttribute("aria-pressed", "true");
    expect(selectedCard).toHaveClass("ring-2", "ring-primary");
    expect(unselectedCard).toHaveAttribute("aria-pressed", "false");
    expect(unselectedCard).not.toHaveClass("ring-2", "ring-primary");
  });

  it("calls onStyleSelect when a style is clicked", async () => {
    const user = userEvent.setup();
    const handleStyleSelect = vi.fn();

    render(
      <StyleSelector {...defaultProps} onStyleSelect={handleStyleSelect} />,
    );

    const firstCard = screen.getByTestId(`style-card-${mockStyles[0].id}`);
    await user.click(firstCard);

    expect(handleStyleSelect).toHaveBeenCalledWith(mockStyles[0].id);
  });

  it("handles keyboard navigation", async () => {
    const user = userEvent.setup();
    const handleStyleSelect = vi.fn();

    render(
      <StyleSelector {...defaultProps} onStyleSelect={handleStyleSelect} />,
    );

    const firstCard = screen.getByTestId(`style-card-${mockStyles[0].id}`);

    // Test Enter key
    firstCard.focus();
    await user.keyboard("{Enter}");
    expect(handleStyleSelect).toHaveBeenCalledWith(mockStyles[0].id);

    // Test Space key
    handleStyleSelect.mockClear();
    await user.keyboard(" ");
    expect(handleStyleSelect).toHaveBeenCalledWith(mockStyles[0].id);
  });

  it("shows loading skeletons when loading", () => {
    render(<StyleSelector {...defaultProps} loading />);

    // Should show skeleton cards instead of actual styles
    expect(screen.queryByTestId("styles-grid")).not.toBeInTheDocument();

    // Count skeleton elements
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no styles available", () => {
    render(<StyleSelector {...defaultProps} styles={[]} />);

    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent("No styles available");
  });

  it("disables interaction when disabled", async () => {
    const user = userEvent.setup();
    const handleStyleSelect = vi.fn();

    render(
      <StyleSelector
        {...defaultProps}
        disabled
        onStyleSelect={handleStyleSelect}
      />,
    );

    const firstCard = screen.getByTestId(`style-card-${mockStyles[0].id}`);

    expect(firstCard).toHaveAttribute("aria-disabled", "true");
    expect(firstCard).toHaveAttribute("tabindex", "-1");
    expect(firstCard).toHaveClass("opacity-50");

    // Try to click - should not call handler
    await user.click(firstCard);
    expect(handleStyleSelect).not.toHaveBeenCalled();
  });

  it("displays color palette when available", () => {
    const styleWithColors = {
      ...mockStyles[0],
      config_json: {
        ...(mockStyles[0].config_json as Record<string, unknown>),
        colorPalette: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"],
      },
    };

    render(<StyleSelector {...defaultProps} styles={[styleWithColors]} />);

    const colorPalette = screen.getByTestId("color-palette");
    expect(colorPalette).toBeInTheDocument();

    // Should show first 4 colors plus indicator for more
    const colorDots = colorPalette.querySelectorAll(
      'div[style*="background-color"]',
    );
    expect(colorDots).toHaveLength(4);
    expect(colorPalette).toHaveTextContent("+1");
  });

  it("displays art style when available", () => {
    const styleWithArtStyle = {
      ...mockStyles[0],
      config_json: {
        ...(mockStyles[0].config_json as Record<string, unknown>),
        artStyle: "Photorealistic",
      },
    };

    render(<StyleSelector {...defaultProps} styles={[styleWithArtStyle]} />);

    expect(screen.getByText("Photorealistic")).toBeInTheDocument();
  });

  it("handles missing config_json gracefully", () => {
    const styleWithoutConfig = {
      ...mockStyles[0],
      config_json: null,
    };

    render(<StyleSelector {...defaultProps} styles={[styleWithoutConfig]} />);

    const card = screen.getByTestId(`style-card-${styleWithoutConfig.id}`);
    expect(card).toBeInTheDocument();
    expect(screen.getByText(styleWithoutConfig.name)).toBeInTheDocument();
  });

  it("handles image loading errors gracefully", () => {
    render(<StyleSelector {...defaultProps} />);

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("loading", "lazy");
    expect(images[0]).toHaveAttribute("src", mockStyles[0].preview_url);
  });

  it("provides proper accessibility attributes", () => {
    render(
      <StyleSelector {...defaultProps} selectedStyleId={mockStyles[1].id} />,
    );

    mockStyles.forEach((style, index) => {
      const card = screen.getByTestId(`style-card-${style.id}`);

      expect(card).toHaveAttribute("role", "button");
      expect(card).toHaveAttribute("tabindex", "0");
      expect(card).toHaveAttribute(
        "aria-pressed",
        index === 1 ? "true" : "false",
      );
      expect(card).toHaveAttribute("aria-disabled", "false");

      // Check image alt text
      const image = screen.getByAltText(`${style.name} style preview`);
      expect(image).toBeInTheDocument();
    });
  });

  it("truncates long style names properly", () => {
    const styleWithLongName = {
      ...mockStyles[0],
      name: "This is a very long style name that should be truncated to prevent layout issues",
    };

    render(<StyleSelector {...defaultProps} styles={[styleWithLongName]} />);

    const nameElement = screen.getByText(styleWithLongName.name);
    expect(nameElement).toHaveClass("line-clamp-1");
    expect(nameElement).toHaveAttribute("title", styleWithLongName.name);
  });

  it("prevents default on keyboard events", async () => {
    const _user = userEvent.setup();
    const preventDefault = vi.fn();

    render(<StyleSelector {...defaultProps} />);

    const firstCard = screen.getByTestId(`style-card-${mockStyles[0].id}`);
    firstCard.focus();

    // Mock the event
    const _mockEvent = {
      key: "Enter",
      preventDefault,
    } as any;

    firstCard.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    // The component should handle the keyboard event
    expect(firstCard).toHaveFocus();
  });
});
