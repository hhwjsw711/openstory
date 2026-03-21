import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { PHASE_DESCRIPTIONS } from '@/lib/generation/phase-descriptions';
import {
  estimateTotalSeconds,
  formatTimeRemaining,
} from '@/lib/generation/time-estimate';
import type { GenerationStreamState } from '@/lib/realtime/generation-stream.reducer';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SHORT_PHASE_NAMES = [
  'Script',
  'Casting',
  'Prompts',
  'Images',
  'Motion',
  'Music',
  'Video',
] as const;

type GenerationProgressBannerProps = {
  generationState: GenerationStreamState;
  isProcessing: boolean;
  startedAt?: Date;
};

export const GenerationProgressBanner: React.FC<
  GenerationProgressBannerProps
> = ({ generationState, isProcessing, startedAt }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (startedAt) {
      return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }
    return 0;
  });
  const startTimeRef = useRef(startedAt?.getTime() ?? Date.now());
  const hasAutoCollapsedRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  // Tick elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-collapse when first image arrives
  useEffect(() => {
    if (hasAutoCollapsedRef.current) return;
    for (const frame of generationState.frames.values()) {
      if (frame.imageStatus === 'completed') {
        hasAutoCollapsedRef.current = true;
        setIsOpen(false);
        return;
      }
    }
  }, [generationState.frames]);

  // Exit animation when generation completes
  useEffect(() => {
    if (!generationState.isComplete) return;
    setIsExiting(true);
  }, [generationState.isComplete]);

  // Don't render after exit animation
  if (isExiting && !isProcessing) return null;
  if (!isProcessing && generationState.currentPhase === 0) return null;

  const sceneCount = generationState.scenes.length;
  const remaining = Math.max(
    0,
    estimateTotalSeconds(sceneCount) - elapsedSeconds
  );

  const activePhase = generationState.phases.find((p) => p.status === 'active');
  const phaseDescription = activePhase
    ? PHASE_DESCRIPTIONS[activePhase.phase]
    : undefined;

  const completedCount = generationState.phases.filter(
    (p) => p.status === 'completed'
  ).length;
  const progressValue = activePhase ? completedCount + 1 : completedCount;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          'mx-4 mt-3 gap-0 py-0 transition-all duration-500',
          isExiting && !prefersReducedMotion && 'translate-y-[-100%] opacity-0',
          isExiting && prefersReducedMotion && 'opacity-0'
        )}
      >
        {/* Always visible: header + progress bar */}
        <CardContent className="flex flex-col gap-2 py-3">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <span className="text-label">Generating&nbsp;sequence</span>

            <span
              className="ml-auto tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              {formatTimeRemaining(remaining)}
            </span>

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
            aria-valuemax={7}
            aria-label={
              activePhase
                ? `Generation progress: ${activePhase.phaseName}`
                : 'Generation progress'
            }
          >
            {generationState.phases.map((phase) => (
              <div
                key={phase.phase}
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
            <div className="hidden gap-0.5 sm:flex">
              {generationState.phases.map((phase, i) => (
                <span
                  key={phase.phase}
                  className={cn(
                    'flex-1 text-center text-[11px] uppercase tracking-wide',
                    phase.status === 'completed' && 'text-muted-foreground',
                    phase.status === 'active' && 'font-medium text-foreground',
                    phase.status === 'pending' && 'text-muted-foreground/40'
                  )}
                >
                  {SHORT_PHASE_NAMES[i]}
                </span>
              ))}
            </div>

            {/* Active phase name + description */}
            {activePhase && (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {activePhase.phaseName}
                </span>
                {phaseDescription && (
                  <p className="text-sm text-muted-foreground">
                    {phaseDescription}
                  </p>
                )}
              </div>
            )}

            {/* "You can leave" message */}
            <p className="text-xs text-muted-foreground/50">
              You can leave — we&rsquo;ll keep working
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
