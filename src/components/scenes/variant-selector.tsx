'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getAspectRatioClassName,
  type AspectRatio,
} from '@/lib/constants/aspect-ratios';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useCallback, useRef, useState, useEffect } from 'react';

type VariantSelectorProps = {
  variantImageUrl: string | null;
  selectedVariantIndex?: number | null;
  onVariantSelect: (index: number) => void;
  loading?: boolean;
  disabled?: boolean;
  aspectRatio?: AspectRatio;
};

export function VariantSelector({
  variantImageUrl,
  selectedVariantIndex = null,
  onVariantSelect,
  loading = false,
  disabled = false,
  aspectRatio = '16:9',
}: VariantSelectorProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [focusableIndex, setFocusableIndex] = useState(0);
  const [pendingVariantIndex, setPendingVariantIndex] = useState<number | null>(
    null
  );

  const handleTileClick = useCallback((index: number) => {
    setPendingVariantIndex(index);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingVariantIndex !== null) {
      onVariantSelect(pendingVariantIndex);
      setPendingVariantIndex(null);
    }
  }, [pendingVariantIndex, onVariantSelect]);

  const handleCancel = useCallback(() => {
    setPendingVariantIndex(null);
  }, []);

  // Reset focusable index when selection changes
  useEffect(() => {
    if (selectedVariantIndex !== null && selectedVariantIndex !== undefined) {
      setFocusableIndex(selectedVariantIndex);
    }
  }, [selectedVariantIndex]);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (pendingVariantIndex !== null && confirmButtonRef.current) {
      // Small delay to ensure Dialog's focus trap is set up first
      const timeoutId = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingVariantIndex]);

  const aspectRatioClass = getAspectRatioClassName(aspectRatio);

  if (!variantImageUrl) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className={cn(aspectRatioClass, 'rounded-lg')} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Grid of 9 tiles, each preserving the aspect ratio */}
      <div
        ref={gridRef}
        className="grid grid-cols-3 gap-2 px-8"
        role="grid"
        aria-label="Variant selection"
      >
        {Array.from({ length: 9 }).map((_, index) => {
          // Calculate the crop position for this tile (0-2 for row and col)
          const row = Math.floor(index / 3);
          const col = index % 3;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleTileClick(index)}
              tabIndex={index === focusableIndex ? 0 : -1}
              disabled={disabled || loading}
              className={cn(
                'group relative rounded-lg overflow-hidden',
                aspectRatioClass,
                'border-2 transition-all duration-200',
                'hover:scale-105 hover:shadow-lg',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                selectedVariantIndex === index
                  ? 'border-primary shadow-md scale-105'
                  : 'border-transparent hover:border-primary/50'
              )}
              aria-label={`Select variant ${index + 1}`}
              aria-selected={selectedVariantIndex === index}
            >
              {/* Cropped tile from the 3x3 grid image */}
              <div
                className="absolute inset-0"
                style={{
                  // Scale up the image 3x and position to show only this tile
                  backgroundImage: `url(${variantImageUrl})`,
                  backgroundSize: '300% 300%',
                  backgroundPosition: `${col * 50}% ${row * 50}%`,
                }}
              />

              {/* Selection Indicator */}
              {selectedVariantIndex === index && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}

              {/* Loading Overlay */}
              {loading && selectedVariantIndex === index && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={pendingVariantIndex !== null}
        onOpenChange={(open) => !open && handleCancel()}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            <DialogHeader>
              <DialogTitle>Select this variant?</DialogTitle>
              <DialogDescription>
                This will replace the current frame image. The video will need
                to be regenerated.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Confirm</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
