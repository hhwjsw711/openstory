import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Frame } from '@/types/database';
import { Check } from 'lucide-react';
import { SceneThumbnail } from './scene-thumbnail';

type SceneListItemProps = {
  frame: Frame;
  isActive: boolean;
  isCompleted: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
  variant?: 'stacked' | 'horizontal' | 'responsive';
};

export const SceneListItem: React.FC<SceneListItemProps> = ({
  frame,
  isActive,
  isCompleted,
  onSelect,
  onToggleComplete,
  variant = 'responsive',
}) => {
  // Extract scene data from frame metadata
  const metadata = frame.metadata as {
    sceneNumber?: number;
    metadata?: { title?: string };
    originalScript?: { extract?: string };
  } | null;

  const sceneNumber = metadata?.sceneNumber ?? frame.orderIndex + 1;
  const title = metadata?.metadata?.title ?? `Scene ${sceneNumber}`;
  const scriptPreview =
    metadata?.originalScript?.extract ?? frame.description ?? '';

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
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-4 top-4 z-10 h-6 w-6 rounded-full',
          isCompleted
            ? 'bg-success text-success-foreground hover:bg-success/90'
            : 'border hover:border-primary'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
      >
        {isCompleted && <Check className="h-4 w-4" />}
      </Button>

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
            thumbnailUrl={frame.thumbnailUrl}
            thumbnailStatus={frame.thumbnailStatus ?? 'pending'}
            alt={title}
            className={cn(
              'w-full rounded-md',
              variant === 'responsive' &&
                '@[280px]/scene:w-32 @[280px]/scene:shrink-0',
              variant === 'horizontal' && 'w-32 shrink-0'
            )}
          />

          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="line-clamp-2 text-xs leading-snug">
              {scriptPreview}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
