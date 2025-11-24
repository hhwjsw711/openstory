'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { Style } from '@/lib/db/schema/libraries';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSelectionDialog } from './style-selection-dialog';

interface StyleSelectorProps {
  styles: Style[];
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function StyleSelector({
  styles,
  selectedStyleId,
  onStyleSelect,
  loading = false,
  disabled = false,
}: StyleSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusableIndex, setFocusableIndex] = useState(0);

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

  // Reset focusable index when styles change or selected style changes
  useEffect(() => {
    if (visibleStyles.length === 0) return;

    // If a style is selected, make it focusable
    const selectedIndex = visibleStyles.findIndex(
      (s) => s.id === selectedStyleId
    );
    if (selectedIndex !== -1) {
      setFocusableIndex(selectedIndex);
    } else {
      // Otherwise, first item is focusable
      setFocusableIndex(0);
    }
  }, [selectedStyleId, visibleStyles]);

  // Calculate actual grid columns from the rendered layout
  const getColumnsCount = useCallback(() => {
    if (!gridRef.current) return 5; // default

    // Get the first two buttons to calculate column count
    const buttons = gridRef.current.querySelectorAll('button');
    if (buttons.length < 2) return 1;

    const firstButton = buttons[0] as HTMLElement;
    const secondButton = buttons[1] as HTMLElement;

    // Get the actual positions
    const firstRect = firstButton.getBoundingClientRect();
    const secondRect = secondButton.getBoundingClientRect();

    // If they're on the same row (top positions are close), they're in different columns
    if (Math.abs(firstRect.top - secondRect.top) < 5) {
      // Calculate columns based on button width and container width
      const containerRect = gridRef.current.getBoundingClientRect();
      const buttonWidth = firstRect.width;
      const gap = secondRect.left - firstRect.right;
      const availableWidth = containerRect.width;

      // Calculate how many buttons fit per row
      const cols = Math.floor((availableWidth + gap) / (buttonWidth + gap));
      return Math.max(1, cols);
    }

    // If second button is below the first, we have 1 column
    return 1;
  }, []);

  // Handle arrow key navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      // Total items = visible styles + "More" button
      const totalItems = visibleStyles.length + 1;
      let nextIndex = currentIndex;
      const cols = getColumnsCount();

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          nextIndex = Math.min(currentIndex + 1, totalItems - 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          nextIndex = Math.min(currentIndex + cols, totalItems - 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          nextIndex = Math.max(currentIndex - cols, 0);
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = totalItems - 1;
          break;
        default:
          return;
      }

      // Update focusable index and move focus
      if (nextIndex !== currentIndex) {
        setFocusableIndex(nextIndex);

        // Focus the next button
        const buttons = gridRef.current?.querySelectorAll('button');
        if (buttons && buttons[nextIndex]) {
          (buttons[nextIndex] as HTMLElement).focus();
        }
      }
    },
    [visibleStyles.length, getColumnsCount]
  );

  const handleStyleSelect = (styleId: string) => {
    onStyleSelect(styleId);
    setDialogOpen(false);
  };

  return (
    <>
      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fill,minmax(65px,1fr))] gap-3 overflow-hidden p-2"
        role="grid"
        aria-label="Style selection"
      >
        {loading
          ? Array.from({ length: GRID_SIZE }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))
          : visibleStyles.map((style, index) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onStyleSelect(style.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                tabIndex={index === focusableIndex ? 0 : -1}
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
                    sizes="80px"
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
            onKeyDown={(e) => handleKeyDown(e, visibleStyles.length)}
            tabIndex={visibleStyles.length === focusableIndex ? 0 : -1}
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
