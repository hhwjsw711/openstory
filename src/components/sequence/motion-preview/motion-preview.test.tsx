import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { generateMockFrame } from "@/lib/mocks/data-generators";
import { MotionPreview } from "./motion-preview";

const mockFrame = generateMockFrame({
  id: "test-motion-frame",
  order_index: 1,
  description: "Test motion frame for unit testing",
  thumbnail_url: "https://example.com/test-thumbnail.jpg",
  duration_ms: 5000,
});

const mockVideoUrl = "https://example.com/test-video.mp4";

// Mock HTMLVideoElement methods
Object.defineProperty(HTMLVideoElement.prototype, "play", {
  writable: true,
  value: vi.fn(() => Promise.resolve()),
});

Object.defineProperty(HTMLVideoElement.prototype, "pause", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLVideoElement.prototype, "currentTime", {
  writable: true,
  value: 0,
});

Object.defineProperty(HTMLVideoElement.prototype, "duration", {
  writable: true,
  value: 10,
});

describe("MotionPreview", () => {
  describe("with video", () => {
    it("renders video preview with controls", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
      expect(screen.getByText("Frame 1")).toBeInTheDocument();

      // Check for video element
      const video = document.querySelector("video");
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute(
        "poster",
        mockFrame.thumbnail_url || "https://via.placeholder.com/300x200",
      );
    });

    it("handles play/pause functionality", async () => {
      const onPlay = vi.fn();
      const onPause = vi.fn();

      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          onPlay={onPlay}
          onPause={onPause}
        />,
      );

      const playButton = screen.getByRole("button", { name: /play/i });
      fireEvent.click(playButton);

      const video = document.querySelector("video");
      expect(video?.play).toHaveBeenCalled();
    });

    it("shows loading state when loading prop is true", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          loading={true}
        />,
      );

      expect(screen.getByText("Loading video...")).toBeInTheDocument();
    });

    it("handles mute/unmute functionality", async () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          muted={false}
        />,
      );

      // Video should start unmuted
      const video = document.querySelector("video");
      expect(video).toHaveAttribute("muted", "false");
    });

    it("sets autoPlay when prop is true", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          autoPlay={true}
        />,
      );

      const video = document.querySelector("video");
      expect(video).toHaveAttribute("autoplay");
    });

    it("formats time display correctly", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      // Time display should be in format MM:SS
      // Initial state should show 0:00 / duration
      const timeDisplay = screen.getByText(/0:00/);
      expect(timeDisplay).toBeInTheDocument();
    });

    it("calls onSeek when progress bar is clicked", () => {
      const onSeek = vi.fn();

      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          onSeek={onSeek}
        />,
      );

      // Find progress bar (the clickable div)
      const progressBar = document.querySelector('[class*="cursor-pointer"]');
      if (progressBar) {
        fireEvent.click(progressBar);
        // onSeek should be called (exact values depend on click position)
        expect(onSeek).toHaveBeenCalled();
      }
    });

    it("shows video controls on hover", () => {
      const { container } = render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      const cardElement = container.querySelector(".group");
      if (cardElement) {
        fireEvent.mouseEnter(cardElement);

        // Controls should become visible
        const controlsOverlay = container.querySelector(
          '[class*="opacity-100"]',
        );
        expect(controlsOverlay).toBeInTheDocument();
      }
    });

    it("handles video events correctly", () => {
      const onPlay = vi.fn();
      const onPause = vi.fn();

      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
          onPlay={onPlay}
          onPause={onPause}
        />,
      );

      const video = document.querySelector("video");
      if (video) {
        // Simulate video play event
        fireEvent.play(video);
        expect(onPlay).toHaveBeenCalled();

        // Simulate video pause event
        fireEvent.pause(video);
        expect(onPause).toHaveBeenCalled();
      }
    });
  });

  describe("without video (thumbnail fallback)", () => {
    it("renders thumbnail fallback when no videoUrl provided", () => {
      render(
        <MotionPreview
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          duration={mockFrame.duration_ms || undefined}
          frame={mockFrame}
        />,
      );

      expect(screen.getByText("No motion generated")).toBeInTheDocument();
      expect(screen.getByText("Frame 1")).toBeInTheDocument();
      expect(screen.getByText("Expected duration: 5.0s")).toBeInTheDocument();

      // Should not have video element
      const video = document.querySelector("video");
      expect(video).not.toBeInTheDocument();
    });

    it("shows expected duration when provided", () => {
      render(
        <MotionPreview
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          duration={7500}
          frame={mockFrame}
        />,
      );

      expect(screen.getByText("Expected duration: 7.5s")).toBeInTheDocument();
    });

    it("handles image loading states", async () => {
      const { container } = render(
        <MotionPreview
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          duration={mockFrame.duration_ms || undefined}
          frame={mockFrame}
        />,
      );

      // Should initially show loading state
      const loadingDiv = container.querySelector(".animate-pulse");
      expect(loadingDiv).toBeInTheDocument();

      // Find and trigger image load
      const image = screen.getByAltText("Frame 1 preview");
      expect(image).toHaveClass("opacity-0"); // Initially hidden

      fireEvent.load(image);

      await waitFor(() => {
        expect(image).toHaveClass("opacity-100"); // Visible after load
      });
    });

    it("handles image error states", async () => {
      render(
        <MotionPreview
          thumbnailUrl="https://broken-url.com/image.jpg"
          duration={mockFrame.duration_ms || undefined}
          frame={mockFrame}
        />,
      );

      const image = screen.getByAltText("Frame 1 preview");
      fireEvent.error(image);

      await waitFor(() => {
        expect(screen.getByText("Failed to load image")).toBeInTheDocument();
      });
    });

    it("does not show duration when not provided", () => {
      render(
        <MotionPreview
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          // No duration provided
          frame={mockFrame}
        />,
      );

      expect(screen.queryByText(/Expected duration/)).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("provides proper alt text for images", () => {
      render(
        <MotionPreview
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          duration={mockFrame.duration_ms || undefined}
          frame={mockFrame}
        />,
      );

      const image = screen.getByAltText("Frame 1 preview");
      expect(image).toBeInTheDocument();
    });

    it("has accessible button labels", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      // Should have play button (since video starts paused)
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });

    it("provides video with proper structure", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      const video = document.querySelector("video");
      expect(video).toHaveAttribute("preload", "metadata");
      expect(video).toHaveAttribute(
        "poster",
        mockFrame.thumbnail_url || "https://via.placeholder.com/300x200",
      );
    });
  });

  describe("frame information display", () => {
    it("displays frame order correctly", () => {
      const frameWithOrder = generateMockFrame({
        ...mockFrame,
        order_index: 5,
      });

      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            frameWithOrder.thumbnail_url ||
            "https://via.placeholder.com/300x200"
          }
          frame={frameWithOrder}
        />,
      );

      expect(screen.getByText("Frame 5")).toBeInTheDocument();
    });

    it("shows active indicator for video frames", () => {
      render(
        <MotionPreview
          videoUrl={mockVideoUrl}
          thumbnailUrl={
            mockFrame.thumbnail_url || "https://via.placeholder.com/300x200"
          }
          frame={mockFrame}
        />,
      );

      // Should show green indicator dot for frames with video
      const indicator = document.querySelector(".bg-green-400");
      expect(indicator).toBeInTheDocument();
    });
  });
});
