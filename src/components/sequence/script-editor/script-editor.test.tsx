import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptEditor } from "./script-editor";

describe("ScriptEditor", () => {
  const defaultProps = {
    value: "",
    onValueChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default props", () => {
    render(<ScriptEditor {...defaultProps} />);

    const textarea = screen.getByTestId("script-editor-textarea");
    const characterCount = screen.getByTestId("character-count");

    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Enter your script here...",
    );
    expect(characterCount).toHaveTextContent("0 / 5,000 characters");
  });

  it("displays current value and character count", () => {
    const testValue = "Hello world!";
    render(<ScriptEditor {...defaultProps} value={testValue} />);

    const textarea = screen.getByTestId("script-editor-textarea");
    const characterCount = screen.getByTestId("character-count");

    expect(textarea).toHaveValue(testValue);
    expect(characterCount).toHaveTextContent("12 / 5,000 characters");
  });

  it("calls onValueChange when text is typed", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<ScriptEditor {...defaultProps} onValueChange={handleChange} />);

    const textarea = screen.getByTestId("script-editor-textarea");
    await user.type(textarea, "New text");

    expect(handleChange).toHaveBeenCalledWith("New text");
  });

  it("respects maxLength prop", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ScriptEditor
        {...defaultProps}
        onValueChange={handleChange}
        maxLength={10}
        value="1234567890" // At max length
      />,
    );

    const textarea = screen.getByTestId("script-editor-textarea");
    const characterCount = screen.getByTestId("character-count");

    expect(characterCount).toHaveTextContent("10 / 10 characters");

    // Try to type more - should not call onValueChange
    await user.type(textarea, "x");
    expect(handleChange).not.toHaveBeenCalledWith("1234567890x");
  });

  it("shows error styling when over max length", () => {
    render(
      <ScriptEditor
        {...defaultProps}
        value="12345678901" // Over max length of 10
        maxLength={10}
      />,
    );

    const textarea = screen.getByTestId("script-editor-textarea");
    const characterCount = screen.getByTestId("character-count");

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(characterCount).toHaveTextContent("11 / 10 characters");
    expect(characterCount.firstChild).toHaveClass("text-destructive");
  });

  it("displays custom error message", () => {
    const errorMessage = "Script is too short";
    render(<ScriptEditor {...defaultProps} error={errorMessage} />);

    const error = screen.getByTestId("error-message");
    const textarea = screen.getByTestId("script-editor-textarea");

    expect(error).toHaveTextContent(errorMessage);
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });

  it("uses custom placeholder", () => {
    const placeholder = "Start writing your story...";
    render(<ScriptEditor {...defaultProps} placeholder={placeholder} />);

    const textarea = screen.getByTestId("script-editor-textarea");
    expect(textarea).toHaveAttribute("placeholder", placeholder);
  });

  it("can be disabled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ScriptEditor {...defaultProps} disabled onValueChange={handleChange} />,
    );

    const textarea = screen.getByTestId("script-editor-textarea");
    expect(textarea).toBeDisabled();

    // Try to type - should not work
    await user.click(textarea);
    await user.type(textarea, "test");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("hides character count when showCharacterCount is false", () => {
    render(<ScriptEditor {...defaultProps} showCharacterCount={false} />);

    expect(screen.queryByTestId("character-count")).not.toBeInTheDocument();
  });

  it("displays character count without max length", () => {
    render(
      <ScriptEditor {...defaultProps} value="Hello" maxLength={undefined} />,
    );

    const characterCount = screen.getByTestId("character-count");
    expect(characterCount).toHaveTextContent("5");
    expect(characterCount).not.toHaveTextContent("/");
  });

  it("formats large numbers with locale formatting", () => {
    render(
      <ScriptEditor
        {...defaultProps}
        value={"A".repeat(1234)}
        maxLength={5000}
      />,
    );

    const characterCount = screen.getByTestId("character-count");
    expect(characterCount).toHaveTextContent("1,234 / 5,000 characters");
  });

  it("handles accessibility correctly", () => {
    render(<ScriptEditor {...defaultProps} error="Test error" />);

    const textarea = screen.getByTestId("script-editor-textarea");
    const errorMessage = screen.getByTestId("error-message");

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(errorMessage).toHaveAttribute("role", "alert");
    expect(errorMessage).toHaveAttribute("aria-live", "polite");
  });

  it("maintains focus behavior", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor {...defaultProps} />);

    const textarea = screen.getByTestId("script-editor-textarea");

    await user.click(textarea);
    expect(textarea).toHaveFocus();
  });

  it("handles empty value correctly", () => {
    render(<ScriptEditor {...defaultProps} value="" />);

    const textarea = screen.getByTestId("script-editor-textarea");
    const characterCount = screen.getByTestId("character-count");

    expect(textarea).toHaveValue("");
    expect(characterCount).toHaveTextContent("0 / 5,000 characters");
  });
});
