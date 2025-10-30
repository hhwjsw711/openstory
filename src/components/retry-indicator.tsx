import { Badge } from '@/components/ui/badge';
import type * as React from 'react';

interface RetryIndicatorProps {
  attempt: number;
  maxAttempts?: number;
}

export const RetryIndicator: React.FC<RetryIndicatorProps> = ({
  attempt,
  maxAttempts = 3,
}) => {
  if (attempt === 0) return null;

  return (
    <Badge variant="destructive">
      Retry {attempt}/{maxAttempts}
    </Badge>
  );
};
