'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

type TimelineScrubberProps = {
  currentSceneIndex: number;
  totalScenes: number;
  frameDurations?: Record<number, number>; // Real durations from video metadata
  currentVideoTime?: number; // Current playback time within the video
  onSeek?: (sceneIndex: number, timeInScene: number) => void; // Callback when user clicks timeline
  className?: string;
};

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentSceneIndex,
  totalScenes,
  frameDurations = {},
  currentVideoTime = 0,
  onSeek,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handle timeline click to seek
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
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

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative h-px w-full bg-white/20 rounded-full cursor-pointer py-2 -my-2"
      >
        {/* Progress bar */}
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
              className="absolute top-0 h-2 w-px bg-white/30 -translate-y-1/2"
              style={{ left: `${markerPosition}%` }}
            />
          );
        })}
      </div>
    </div>
  );
};
