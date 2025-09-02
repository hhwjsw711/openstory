import type * as React from "react";

interface ProgressData {
  completed: number;
  total: number;
  percentage: number;
}

interface ProgressSectionProps {
  progress: ProgressData;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({
  progress,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Setup Progress</span>
        <span className="font-medium">
          {progress.completed} of {progress.total} steps
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress.percentage}%` }}
          data-testid="progress-bar"
        />
      </div>
    </div>
  );
};
