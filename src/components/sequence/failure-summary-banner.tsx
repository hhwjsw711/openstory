import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { FailureSummary } from '@/lib/failures/failure-analysis';
import { AlertCircle, RotateCcw } from 'lucide-react';

type FailureSummaryBannerProps = {
  summary: FailureSummary;
  onRetry: () => void;
  isRetrying: boolean;
};

export const FailureSummaryBanner: React.FC<FailureSummaryBannerProps> = ({
  summary,
  onRetry,
  isRetrying,
}) => (
  <Alert variant="destructive" className="mx-4 mt-2">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>
      {summary.requiresFullRetry
        ? 'Generation failed'
        : 'Generation partially failed'}
    </AlertTitle>
    <AlertDescription>
      <p>{summary.headline}</p>

      {summary.groups.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs underline">
            View error details
          </summary>
          <div className="mt-2 space-y-2 text-xs font-mono">
            {summary.groups.map((group) => (
              <div key={group.category}>
                <span className="font-semibold">{group.category}:</span>
                {group.frames.map((f) => (
                  <div key={f.frameId} className="ml-2">
                    Scene {f.orderIndex + 1}
                    {f.sceneTitle !== `Scene ${f.orderIndex + 1}` &&
                      ` (${f.sceneTitle})`}
                    : {f.error || 'Unknown error'}
                  </div>
                ))}
                {group.error && <div className="ml-2">{group.error}</div>}
              </div>
            ))}
          </div>
        </details>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-2"
      >
        <RotateCcw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
        {isRetrying
          ? 'Retrying\u2026'
          : summary.requiresFullRetry
            ? 'Retry'
            : 'Retry Failed'}
      </Button>
    </AlertDescription>
  </Alert>
);
