import { GalleryIcon } from '@/components/icons/gallery-icon';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Style } from '@/types/database';
import Image from 'next/image';
import type { FC, KeyboardEvent } from 'react';
import { useCallback } from 'react';

type StyleGridProps = {
  styles: Style[];
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
  onStyleSelectAndClose?: (styleId: string) => void;
  isLoading?: boolean;
};

type StyleCardProps = {
  style: Style;
  selected: boolean;
  onSelect: (styleId: string) => void;
  onSelectAndClose?: (styleId: string) => void;
};

const StyleCard: FC<StyleCardProps> = ({
  style,
  selected,
  onSelect,
  onSelectAndClose,
}) => {
  const handleClick = useCallback(() => {
    onSelect(style.id);
  }, [style.id, onSelect]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (selected && event.key === 'Enter' && onSelectAndClose) {
          // If already selected, close the dialog
          onSelectAndClose(style.id);
        } else {
          // Otherwise just select it
          handleClick();
        }
      }
    },
    [handleClick, onSelectAndClose, style.id, selected]
  );

  const styleName = style.name ? style.name.toUpperCase() : undefined;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:scale-105',
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-pressed={selected}
      data-testid={`style-card-${style.id}`}
    >
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-muted">
          {style.previewUrl ? (
            <Image
              src={style.previewUrl}
              alt={`${style.name} style preview`}
              fill
              className="object-cover"
              loading="lazy"
              sizes="(min-width: 1280px) 280px, (min-width: 1024px) 240px, (min-width: 768px) 200px, 160px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <GalleryIcon
                className="text-muted-foreground opacity-50"
                size="lg"
              />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3
            className="text-center text-xs font-semibold uppercase tracking-wider"
            title={styleName}
          >
            {styleName}
          </h3>
        </div>
      </CardContent>
    </Card>
  );
};

const StyleCardSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <Skeleton className="aspect-[4/3] rounded-t-lg" />
      <div className="p-3">
        <Skeleton className="mx-auto h-3 w-3/4" />
      </div>
    </CardContent>
  </Card>
);

export const StyleGrid: FC<StyleGridProps> = ({
  styles,
  selectedStyleId,
  onStyleSelect,
  onStyleSelectAndClose,
  isLoading = false,
}) => {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 p-4 overflow-auto"
      data-testid="style-grid"
    >
      {isLoading
        ? Array.from({ length: 10 }, (_, index) => (
            <StyleCardSkeleton key={`skeleton-${index}`} />
          ))
        : styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              selected={selectedStyleId === style.id}
              onSelect={onStyleSelect}
              onSelectAndClose={onStyleSelectAndClose}
            />
          ))}
    </div>
  );
};
