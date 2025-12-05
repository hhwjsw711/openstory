import { Badge } from '@/components/ui/badge';
import type { SequenceStatus } from '@/lib/db/schema/sequences';
import { AlertCircle } from 'lucide-react';

type SequenceStatusBadgeProps = {
  status: SequenceStatus | undefined;
};

export const SequenceStatusBadge: React.FC<SequenceStatusBadgeProps> = ({
  status,
}) => {
  if (status !== 'failed') return null;

  return (
    <Badge variant="destructive">
      <AlertCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
};
