import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS } from '@/lib/ai/models';
import { getAnalysisModelById } from '@/lib/ai/models.config';

export const ModelBadge = ({ model }: { model?: string }) => {
  if (!model) {
    return <Skeleton className="w-[100px] h-[24px]" />;
  }

  return (
    <Badge
      variant={
        getAnalysisModelById(model)?.tier === 'premium'
          ? 'default'
          : 'secondary'
      }
      className="text-xs"
    >
      {getAnalysisModelById(model)?.name || model}
    </Badge>
  );
};

export const ImageModelBadge = ({ model }: { model?: string }) => {
  if (!model) {
    return <Skeleton className="w-[100px] h-[24px]" />;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {IMAGE_MODELS[model as keyof typeof IMAGE_MODELS]?.name || model}
    </Badge>
  );
};

export const VideoModelBadge = ({ model }: { model?: string }) => {
  if (!model) {
    return <Skeleton className="w-[100px] h-[24px]" />;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {IMAGE_TO_VIDEO_MODELS[model as keyof typeof IMAGE_TO_VIDEO_MODELS]
        ?.name || model}
    </Badge>
  );
};
