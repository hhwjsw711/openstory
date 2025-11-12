import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getModelById } from '@/lib/ai/models.config';

export const ModelBadge = ({ model }: { model?: string }) => {
  if (!model) {
    return <Skeleton className="w-[100px] h-[24px]" />;
  }

  return (
    <Badge
      variant={
        getModelById(model)?.tier === 'premium' ? 'default' : 'secondary'
      }
      className="text-xs"
    >
      {getModelById(model)?.name || model}
    </Badge>
  );
};
