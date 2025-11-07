import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { Check } from 'lucide-react';
import { SceneThumbnail } from './scene-thumbnail';

type SceneListItemProps = {
  frame?: Frame | undefined;
  isActive?: boolean;
  isCompleted?: boolean;
  onSelect?: () => void;
  variant?: 'stacked' | 'horizontal' | 'responsive';
};

export const SceneListItem: React.FC<SceneListItemProps> = ({
  frame,
  isActive = false,
  isCompleted = false,
  onSelect,
  variant = 'responsive',
}) => {
  // Extract scene data from frame metadata
  const metadata = frame?.metadata;

  const sceneNumber = metadata?.sceneNumber ?? (frame?.orderIndex ?? 0) + 1;
  const title = !frame
    ? undefined
    : (metadata?.metadata?.title ?? `Scene ${sceneNumber}`);
  const scriptPreview = !frame
    ? undefined
    : (metadata?.originalScript?.extract ?? frame?.description ?? '');

  return (
    <Card
      className={cn(
        '@container/scene relative cursor-pointer transition-all',
        isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
        variant === 'responsive' && '@[280px]/scene:py-3',
        variant === 'horizontal' && 'py-3',
        'py-3'
      )}
      onClick={onSelect}
    >
      {isCompleted && (
        <Check
          className={cn(
            'absolute right-4 top-4 z-10 h-6 w-6 p-1 rounded-full',
            'bg-success text-success-foreground'
          )}
        />
      )}
      {frame && !isCompleted && (
        <Skeleton className="absolute right-4 top-4 z-10 h-6 w-6 rounded-full" />
      )}

      <CardHeader>
        <div
          className={cn(
            'flex flex-col gap-3',
            variant === 'responsive' &&
              '@[280px]/scene:flex-row @[280px]/scene:gap-4',
            variant === 'horizontal' && 'flex-row gap-4'
          )}
        >
          <SceneThumbnail
            thumbnailUrl={frame?.thumbnailUrl}
            thumbnailStatus={frame?.thumbnailStatus ?? 'pending'}
            alt={title ?? 'Scene thumbnail'}
            className={cn(
              'w-full rounded-md',
              variant === 'responsive' &&
                '@[280px]/scene:w-32 @[280px]/scene:shrink-0',
              variant === 'horizontal' && 'w-32 shrink-0'
            )}
          />

          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-sm">
              {title ?? <Skeleton className="w-24 h-4" />}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs leading-snug">
              {scriptPreview ?? <Skeleton className="w-full h-4" />}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
