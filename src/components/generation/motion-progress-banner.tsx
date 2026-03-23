import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_TO_VIDEO_MODELS,
  safeImageToVideoModel,
} from '@/lib/ai/models';
import type { Frame } from '@/lib/db/schema/frames';
import type { Sequence } from '@/lib/db/schema/sequences';
import { formatTimeRemaining } from '@/lib/generation/time-estimate';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type MotionProgressBannerProps = {
  frames: Frame[];
  sequence: Sequence;
  includeMusic: boolean;
  startedAt: number;
  onComplete: () => void;
};

type PhaseStatus = 'pending' | 'active' | 'completed';

type Phase = {
  key: string;
  name: string;
  shortName: string;
  status: PhaseStatus;
  budgetSeconds: number;
  description: string;
};

const MUSIC_BUDGET_SECONDS = 30;
const MERGE_VIDEO_BUDGET_SECONDS = 30;
const MERGE_AUDIO_VIDEO_BUDGET_SECONDS = 30;

// Fal.ai queues frames with limited concurrency — observed ~2x overhead
// vs model estimate (e.g. 9 frames × 15s model = 135s, actual ~300s).
const QUEUE_OVERHEAD_FACTOR = 2;

function getMotionBudget(sequence: Sequence, frameCount: number): number {
  const modelKey = safeImageToVideoModel(
    sequence.videoModel,
    DEFAULT_VIDEO_MODEL
  );
  const config = IMAGE_TO_VIDEO_MODELS[modelKey];
  const perFrame = config?.performance.estimatedGenerationTime ?? 20;
  return perFrame * frameCount * QUEUE_OVERHEAD_FACTOR;
}

function isTerminal(status: string | null): boolean {
  return status === 'completed' || status === 'failed';
}

function derivePhases(
  frames: Frame[],
  sequence: Sequence,
  includeMusic: boolean
): Phase[] {
  const allMotionDone =
    frames.length > 0 && frames.every((f) => isTerminal(f.videoStatus));
  const musicDone = isTerminal(sequence.musicStatus);

  // Phase 1: Motion + Music (parallel) or Motion only
  // Since motion and music run in parallel, this phase completes when BOTH finish
  const motionMusicComplete = includeMusic
    ? allMotionDone && musicDone
    : allMotionDone;
  const motionMusicStatus: PhaseStatus = motionMusicComplete
    ? 'completed'
    : 'active';

  const motionBudget = getMotionBudget(sequence, frames.length);
  // Parallel: budget is max of the two, not sum
  const phase1Budget = includeMusic
    ? Math.max(motionBudget, MUSIC_BUDGET_SECONDS)
    : motionBudget;

  const phases: Phase[] = [
    {
      key: 'motion-music',
      name: includeMusic
        ? 'Generating motion & music\u2026'
        : 'Generating motion\u2026',
      shortName: includeMusic ? 'Motion & Music' : 'Motion',
      status: motionMusicStatus,
      budgetSeconds: phase1Budget,
      description: includeMusic
        ? 'Animating scenes and composing music in parallel.'
        : 'Animating each scene with camera movement and motion effects.',
    },
  ];

  // Phase 2: Merge — only for multi-frame sequences
  // mergedVideoStatus flips to 'merging' twice when music is included
  // (video merge, then audio+video merge), but we show it as one continuous phase
  if (frames.length > 1) {
    const mergeDone =
      sequence.mergedVideoStatus === 'completed' && motionMusicComplete;
    const mergeActive =
      sequence.mergedVideoStatus === 'merging' ||
      (motionMusicComplete && !mergeDone);
    const mergeStatus: PhaseStatus = mergeDone
      ? 'completed'
      : mergeActive
        ? 'active'
        : 'pending';

    const mergeBudget = includeMusic
      ? MERGE_VIDEO_BUDGET_SECONDS + MERGE_AUDIO_VIDEO_BUDGET_SECONDS
      : MERGE_VIDEO_BUDGET_SECONDS;

    phases.push({
      key: 'merge',
      name: 'Merging video\u2026',
      shortName: 'Merge',
      status: mergeStatus,
      budgetSeconds: mergeBudget,
      description: includeMusic
        ? 'Stitching scenes and audio together into the final video.'
        : 'Stitching all scenes together into the final video.',
    });
  }

  return phases;
}

export const MotionProgressBanner: React.FC<MotionProgressBannerProps> = ({
  frames,
  sequence,
  includeMusic,
  startedAt,
  onComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  );
  const startTimeRef = useRef(startedAt);
  const [isExiting, setIsExiting] = useState(false);

  // Tick elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const phases = useMemo(
    () => derivePhases(frames, sequence, includeMusic),
    [frames, sequence, includeMusic]
  );

  const allComplete = phases.every((p) => p.status === 'completed');

  // Exit animation when all phases complete
  useEffect(() => {
    if (!allComplete) return;
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, 1500); // brief pause to show completion
    return () => clearTimeout(timer);
  }, [allComplete]);

  // Notify parent after exit animation
  useEffect(() => {
    if (!isExiting) return;
    const timer = setTimeout(onComplete, 500);
    return () => clearTimeout(timer);
  }, [isExiting, onComplete]);

  const totalBudget = phases.reduce((sum, p) => sum + p.budgetSeconds, 0);
  const remaining = Math.max(0, totalBudget - elapsedSeconds);

  const activePhase = phases.find((p) => p.status === 'active');
  const completedCount = phases.filter((p) => p.status === 'completed').length;
  const progressValue = activePhase ? completedCount + 1 : completedCount;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          'gap-0 py-0 transition-all duration-500',
          isExiting && !prefersReducedMotion && 'translate-y-[-100%] opacity-0',
          isExiting && prefersReducedMotion && 'opacity-0'
        )}
      >
        <CardContent className="flex flex-col gap-2 py-3">
          {/* Header row */}
          <div className="flex items-center gap-3">
            {allComplete ? (
              <div className="h-4 w-4 shrink-0 text-primary">&#10003;</div>
            ) : (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            )}
            <span className="text-sm font-medium truncate">
              {allComplete
                ? 'Motion complete'
                : activePhase
                  ? activePhase.name
                  : 'Generating\u00a0motion'}
            </span>

            <Badge
              variant="secondary"
              className="ml-auto tabular-nums"
              aria-live="polite"
            >
              {allComplete ? 'Done' : formatTimeRemaining(remaining)}
            </Badge>

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {isOpen ? 'Collapse' : 'Expand'} progress
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Segmented progress bar */}
          <div
            className="flex gap-0.5"
            role="progressbar"
            aria-valuenow={progressValue}
            aria-valuemin={0}
            aria-valuemax={phases.length}
            aria-label={
              activePhase
                ? `Motion progress: ${activePhase.name}`
                : 'Motion progress'
            }
          >
            {phases.map((phase) => (
              <div
                key={phase.key}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-500',
                  phase.status === 'completed' && 'bg-primary',
                  phase.status === 'active' &&
                    'bg-primary/60' +
                      (!prefersReducedMotion ? ' animate-pulse' : ''),
                  phase.status === 'pending' && 'bg-border'
                )}
              />
            ))}
          </div>
        </CardContent>

        {/* Expanded content */}
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 border-t py-3">
            {/* Phase labels aligned to segments — hidden on mobile */}
            <div className="hidden gap-4 sm:flex">
              {phases.map((phase) => (
                <span
                  key={phase.key}
                  className={cn(
                    'flex-1 text-center text-[11px] tracking-wide',
                    phase.status === 'completed' && 'text-muted-foreground',
                    phase.status === 'active' && 'font-medium text-foreground',
                    phase.status === 'pending' && 'text-muted-foreground/40'
                  )}
                >
                  {phase.shortName}
                </span>
              ))}
            </div>

            {/* Active phase description */}
            {activePhase && (
              <p className="text-sm text-muted-foreground">
                {activePhase.description}
              </p>
            )}

            {/* "You can leave" message */}
            <p className="text-xs text-muted-foreground/50">
              Click around or create something else while you&rsquo;re waiting
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
