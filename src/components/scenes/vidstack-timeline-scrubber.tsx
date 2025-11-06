'use client';

import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';

type VidstackTimelineScrubberProps = {
  currentSceneIndex: number;
  totalScenes: number;
  frameDurations?: Record<number, number>;
  currentVideoTime?: number;
  onSeek?: (sceneIndex: number, timeInScene: number) => void;
  className?: string;
};

export const VidstackTimelineScrubber: React.FC<
  VidstackTimelineScrubberProps
> = ({
  currentSceneIndex,
  totalScenes,
  frameDurations = {},
  currentVideoTime = 0,
  onSeek,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Calculate cumulative durations for each scene
  const cumulativeDurations: number[] = [];
  let total = 0;
  for (let i = 0; i < totalScenes; i++) {
    cumulativeDurations.push(total);
    total += frameDurations[i] || 3; // Fallback to 3s for images/loading
  }
  const totalDuration = total;

  // Current time = sum of previous scenes + current video time
  const currentTime = cumulativeDurations[currentSceneIndex] + currentVideoTime;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Handle seeking
  const handleSeek = (clientX: number) => {
    if (!onSeek || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const clickedTime = percentage * totalDuration;

    // Find which scene this time falls into
    let targetSceneIndex = 0;
    let timeInScene = 0;

    for (let i = 0; i < totalScenes; i++) {
      const sceneDuration = frameDurations[i] || 3;
      const sceneStart = cumulativeDurations[i];
      const sceneEnd = sceneStart + sceneDuration;

      if (clickedTime >= sceneStart && clickedTime <= sceneEnd) {
        targetSceneIndex = i;
        timeInScene = clickedTime - sceneStart;
        break;
      }
    }

    onSeek(targetSceneIndex, timeInScene);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleSeek(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    handleSeek(e.clientX);
  };

  return (
    <div
      className={cn('group relative w-full h-8 flex items-center', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setIsDragging(false);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={trackRef}
        className={cn(
          'relative w-full bg-white/20 rounded-full cursor-pointer transition-all',
          isHovering || isDragging ? 'h-1.5' : 'h-1'
        )}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        role="slider"
        aria-label="Timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={totalDuration}
        aria-valuenow={currentTime}
      >
        {/* Progress fill */}
        <div
          className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-100"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />

        {/* Scene markers */}
        {Array.from({ length: totalScenes - 1 }).map((_, i) => {
          const markerPosition =
            totalDuration > 0
              ? (cumulativeDurations[i + 1] / totalDuration) * 100
              : ((i + 1) / totalScenes) * 100;

          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-white/40 pointer-events-none"
              style={{ left: `${markerPosition}%` }}
            />
          );
        })}

        {/* Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md transition-opacity',
            isHovering || isDragging ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            left: `${Math.min(progress, 100)}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
};
