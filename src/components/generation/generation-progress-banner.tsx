import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Check, ChevronDown, ChevronUp, Circle, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'border-b bg-muted/50 transition-all duration-500',
          isExiting && !prefersReducedMotion && 'translate-y-[-100%] opacity-0',
          isExiting && prefersReducedMotion && 'opacity-0'
        )}
      >
        {/* Header row — always visible */}
        <div className="flex items-center gap-3 px-4 py-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="text-sm font-medium">Generating sequence</span>

          {/* Collapsed inline: phase name */}
          {!isOpen && activePhase && (
            <span className="text-sm text-muted-foreground">
              — {activePhase.phaseName}
            </span>
          )}

          <span
            className="ml-auto text-sm tabular-nums text-muted-foreground"
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

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="flex flex-col gap-3 px-4 pb-3">
            {/* Phase grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {generationState.phases.map((phase) => (
                <div key={phase.phase} className="flex items-center gap-2">
                  {phase.status === 'completed' ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : phase.status === 'active' ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      phase.status === 'completed' && 'text-muted-foreground',
                      phase.status === 'active' && 'font-medium',
                      phase.status === 'pending' && 'text-muted-foreground/50'
                    )}
                  >
                    {phase.phaseName}
                  </span>
                </div>
              ))}
            </div>

            {/* Phase description */}
            {phaseDescription && (
              <p className="text-xs text-muted-foreground">
                {phaseDescription}
              </p>
            )}

            {/* "You can leave" message */}
            <Badge variant="secondary" className="w-fit text-xs">
              You can leave — we&rsquo;ll keep working
            </Badge>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
