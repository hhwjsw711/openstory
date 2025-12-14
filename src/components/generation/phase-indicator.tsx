'use client';

import { cn } from '@/lib/utils';
import { Check, Circle, Loader2 } from 'lucide-react';
import type { GenerationPhase } from '@/lib/realtime/generation-stream.reducer';

type PhaseIndicatorProps = {
  phases: GenerationPhase[];
  currentPhase: number;
  className?: string;
};

/**
 * Displays the progress through generation phases as a horizontal stepper.
 * Shows completed phases with checkmarks, the active phase with a spinner,
 * and pending phases as empty circles.
 */
function PhaseIndicator({
  phases,
  currentPhase,
  className,
}: PhaseIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {phases.map((phase, index) => {
        const isActive = phase.status === 'active';
        const isCompleted = phase.status === 'completed';
        const isPending = phase.status === 'pending';

        return (
          <div key={phase.phase} className="flex items-center">
            {/* Phase indicator */}
            <div
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-300',
                isCompleted && 'bg-primary text-primary-foreground',
                isActive && 'bg-primary/20 text-primary',
                isPending && 'bg-muted text-muted-foreground'
              )}
              title={phase.phaseName}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>

            {/* Connector line (not after last item) */}
            {index < phases.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-4 transition-all duration-300',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}

      {/* Current phase name */}
      {currentPhase > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          {phases.find((p) => p.phase === currentPhase)?.phaseName}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version showing just the current phase name and progress.
 */
export function PhaseIndicatorCompact({
  phases,
  className,
}: Omit<PhaseIndicatorProps, 'currentPhase'>) {
  const activePhase = phases.find((p) => p.status === 'active');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">
        {activePhase?.phaseName ?? 'Processing'}
      </span>
    </div>
  );
}
