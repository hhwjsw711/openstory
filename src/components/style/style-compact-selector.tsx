'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { Style } from '@/lib/db/schema/libraries';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { StyleSelectionDialog } from './style-selection-dialog';

interface StyleCompactSelectorProps {
  styles: Style[];
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function StyleCompactSelector({
  styles,
  selectedStyleId,
  onStyleSelect,
  loading = false,
  disabled = false,
}: StyleCompactSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Always show max 10 items total (9 styles + More tile, or all styles + More tile if < 10)
  const GRID_SIZE = 10;

  // Reorder styles to place selected style at the beginning if it exists
  const reorderedStyles = useMemo(() => {
    if (!selectedStyleId) return styles;

    const selectedIndex = styles.findIndex((s) => s.id === selectedStyleId);
    if (selectedIndex === -1) return styles;

    // If selected style is already in the first 9 positions, don't reorder
    if (selectedIndex < GRID_SIZE - 1) return styles;

    // Move selected style to the front
    const selectedStyle = styles[selectedIndex];
    return [selectedStyle, ...styles.filter((s) => s.id !== selectedStyleId)];
  }, [styles, selectedStyleId]);

  const hasMoreThanGrid = reorderedStyles.length >= GRID_SIZE;
  const visibleStyles = hasMoreThanGrid
    ? reorderedStyles.slice(0, GRID_SIZE - 1)
    : reorderedStyles;

  const handleStyleSelect = (styleId: string) => {
    onStyleSelect(styleId);
    setDialogOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16 gap-3 overflow-hidden p-2">
        {loading
          ? Array.from({ length: GRID_SIZE }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))
          : visibleStyles.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onStyleSelect(style.id)}
                disabled={disabled}
                className={cn(
                  'group relative aspect-square rounded-lg overflow-hidden',
                  'border-2 transition-all duration-200',
                  'hover:scale-105 hover:shadow-lg',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  selectedStyleId === style.id
                    ? 'border-primary shadow-md scale-105'
                    : 'border-transparent hover:border-primary/50'
                )}
                aria-label={`Select ${style.name} style`}
              >
                {/* Background Image */}
                {style.previewUrl ? (
                  <Image
                    src={style.previewUrl}
                    alt={style.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                )}

                {/* Name Overlay on Image */}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent">
                  <p className="text-xs font-medium text-white text-center line-clamp-2">
                    {style.name}
                  </p>
                </div>

                {/* Selection Indicator */}
                {selectedStyleId === style.id && (
                  <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                )}
              </button>
            ))}

        {/* More Options Tile - Always show as last item in grid */}
        {!loading && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
            className={cn(
              'aspect-square rounded-lg overflow-hidden',
              'border-2 border-dashed border-muted-foreground/30',
              'flex flex-col items-center justify-center gap-2',
              'hover:border-primary hover:bg-muted/50',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label={`View all ${styles.length} styles`}
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium text-center">
              {hasMoreThanGrid
                ? `+${reorderedStyles.length - (GRID_SIZE - 1)} More`
                : `View All (${reorderedStyles.length})`}
            </span>
          </button>
        )}
      </div>

      {/* Full Style Selection Dialog */}
      <StyleSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        styles={styles}
        selectedStyleId={selectedStyleId}
        onStyleSelect={handleStyleSelect}
      />
    </>
  );
}
