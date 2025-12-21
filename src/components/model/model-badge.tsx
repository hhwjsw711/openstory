import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  isValidTextToImageModel,
  isValidImageToVideoModel,
} from '@/lib/ai/models';
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

  const modelConfig = isValidTextToImageModel(model)
    ? IMAGE_MODELS[model]
    : undefined;
  return (
    <Badge variant="secondary" className="text-xs">
      {modelConfig?.name || model}
    </Badge>
  );
};

export const VideoModelBadge = ({ model }: { model?: string }) => {
  if (!model) {
    return <Skeleton className="w-[100px] h-[24px]" />;
  }

  const modelConfig = isValidImageToVideoModel(model)
    ? IMAGE_TO_VIDEO_MODELS[model]
    : undefined;
  return (
    <Badge variant="secondary" className="text-xs">
      {modelConfig?.name || model}
    </Badge>
  );
};
