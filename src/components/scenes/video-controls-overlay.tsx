'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/utils/format-time';
import { cn } from '@/lib/utils';

type VideoControlsOverlayProps = {
  isPlaying: boolean;
  currentSceneIndex: number;
  totalScenes: number;
  currentTime: number; // in seconds
  totalTime: number; // in seconds
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

export const VideoControlsOverlay: React.FC<VideoControlsOverlayProps> = ({
  isPlaying,
  currentSceneIndex,
  totalScenes,
  currentTime,
  totalTime,
  onPlayPause,
  onPrevious,
  onNext,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3',
        className
      )}
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={onPrevious}
          className="h-7 w-7 md:h-8 md:w-8 rounded-full text-white hover:bg-white/20"
          aria-label="Previous scene"
        >
          <SkipBack className="h-3 w-3 md:h-4 md:w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onPlayPause}
          className="h-8 w-8 md:h-9 md:w-9 rounded-full text-white hover:bg-white/20"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 md:h-5 md:w-5" />
          ) : (
            <Play className="h-4 w-4 md:h-5 md:w-5" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onNext}
          className="h-7 w-7 md:h-8 md:w-8 rounded-full text-white hover:bg-white/20"
          aria-label="Next scene"
        >
          <SkipForward className="h-3 w-3 md:h-4 md:w-4" />
        </Button>
      </div>

      {/* Timecode */}
      <div className="text-xs font-medium text-white tabular-nums">
        {formatTime(currentTime)} / {formatTime(totalTime)}
      </div>

      {/* Scene Indicator */}
      <div className="text-xs font-medium text-white/80">
        Scene {currentSceneIndex + 1} of {totalScenes}
      </div>
    </div>
  );
};
