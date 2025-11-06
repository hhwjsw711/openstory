'use client';

import { useState, useRef, useEffect } from 'react';
import type { Frame } from '@/types/database';
import { ScenePreview } from './scene-preview';
import { TimelineScrubber } from './timeline-scrubber';
import { VideoControlsOverlay } from './video-controls-overlay';
import { cn } from '@/lib/utils';

type ScenePlayerProps = {
  frames: Frame[];
  className?: string;
  onSceneChange?: (sceneIndex: number) => void;
};

export const ScenePlayer: React.FC<ScenePlayerProps> = ({
  frames,
  className,
  onSceneChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [frameDurations, setFrameDurations] = useState<Record<number, number>>(
    {}
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentFrame = frames[currentSceneIndex] || null;
  const currentFrameHasVideo =
    currentFrame?.videoUrl && currentFrame?.videoStatus === 'completed';

  // Handle next scene
  const handleNext = () => {
    const nextIndex = (currentSceneIndex + 1) % frames.length;
    setCurrentSceneIndex(nextIndex);
    setCurrentVideoTime(0);
    onSceneChange?.(nextIndex);
  };

  // Handle previous scene
  const handlePrevious = () => {
    const prevIndex =
      currentSceneIndex === 0 ? frames.length - 1 : currentSceneIndex - 1;
    setCurrentSceneIndex(prevIndex);
    setCurrentVideoTime(0);
    onSceneChange?.(prevIndex);
  };

  // Handle play/pause
  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Handle seeking to a specific time in timeline
  const handleSeek = (sceneIndex: number, timeInScene: number) => {
    setCurrentSceneIndex(sceneIndex);
    setCurrentVideoTime(0);
    onSceneChange?.(sceneIndex);

    // Set video time after frame switches
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = timeInScene;
      }
    }, 0);
  };

  // Reset video time when switching to image-only frame
  useEffect(() => {
    if (!currentFrameHasVideo) {
      setCurrentVideoTime(0);
    }
  }, [currentSceneIndex, currentFrameHasVideo]);

  // Update current video time
  useEffect(() => {
    if (!isPlaying || !currentFrameHasVideo || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current) {
        setCurrentVideoTime(videoRef.current.currentTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentFrameHasVideo]);

  // Calculate total time
  const totalDuration = frames.reduce(
    (sum, _, i) => sum + (frameDurations[i] || 3),
    0
  );
  const currentTime =
    frames
      .slice(0, currentSceneIndex)
      .reduce((sum, _, i) => sum + (frameDurations[i] || 3), 0) +
    currentVideoTime;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Hidden videos for metadata loading */}
      {frames.map((frame, index) =>
        frame.videoUrl ? (
          <video
            key={frame.id}
            src={frame.videoUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const duration = e.currentTarget.duration;
              // Only set duration if it's a valid number (not NaN or Infinity)
              if (duration && isFinite(duration)) {
                setFrameDurations((prev) => ({
                  ...prev,
                  [index]: duration,
                }));
              }
            }}
            onError={(e) => {
              console.error(
                `Failed to load video metadata for frame ${index}:`,
                e
              );
            }}
            className="hidden"
          />
        ) : null
      )}

      {/* Main preview */}
      <div className="flex-1 flex items-center justify-center">
        <ScenePreview
          frame={currentFrame}
          isPlaying={isPlaying}
          onEnded={handleNext}
          videoRef={videoRef}
        />
      </div>

      {/* Controls overlay */}
      <div className="bg-gradient-to-t from-black/60 via-black/40 to-transparent rounded-lg">
        <div className="px-4 py-2">
          <TimelineScrubber
            currentSceneIndex={currentSceneIndex}
            totalScenes={frames.length}
            frameDurations={frameDurations}
            currentVideoTime={currentVideoTime}
            onSeek={handleSeek}
          />
        </div>
        <VideoControlsOverlay
          isPlaying={isPlaying}
          currentSceneIndex={currentSceneIndex}
          totalScenes={frames.length}
          currentTime={currentTime}
          totalTime={totalDuration}
          onPlayPause={handlePlayPause}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </div>
    </div>
  );
};
