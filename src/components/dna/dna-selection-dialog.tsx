'use client';

import { GalleryIcon } from '@/components/icons/gallery-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useStyles } from '@/hooks/use-styles';
import { cn } from '@/lib/utils';
import { filterStyles } from '@/lib/utils/style-filters';
import type { Style } from '@/types/database';
import { SearchIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import type { ChangeEvent, FC, KeyboardEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

type DnaSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
};

type StyleCardProps = {
  style: Style;
  selected: boolean;
  onSelect: (styleId: string) => void;
};

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'cinematic', label: 'TikTok Core' },
  { id: 'artistic', label: 'Instagram Aesthetics' },
  { id: 'documentary', label: 'Camera Presets' },
  { id: 'animation', label: 'Beauty' },
  { id: 'commercial', label: 'Mood' },
  { id: 'vintage', label: 'Surreal' },
  { id: 'futuristic', label: 'Graphic Art' },
] as const;

const StyleCard: FC<StyleCardProps> = ({ style, selected, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(style.id);
  }, [style.id, onSelect]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const styleName =
    style.config &&
    typeof style.config === 'object' &&
    'name' in style.config &&
    typeof style.config.name === 'string'
      ? style.config.name.toUpperCase()
      : style.name.toUpperCase();

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-pressed={selected}
      data-testid={`dna-card-${style.id}`}
    >
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-muted">
          {style.previewUrl ? (
            <Image
              src={style.previewUrl}
              alt={`${style.name} style preview`}
              className="h-full w-full object-cover"
              loading="lazy"
              fill
              sizes="(min-width: 1280px) 280px, (min-width: 1024px) 240px, (min-width: 768px) 200px, 160px"
              onError={(e) => {
                console.warn(
                  `Failed to load image for style ${style.name}:`,
                  style.previewUrl
                );
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <GalleryIcon
                className="text-muted-foreground opacity-50"
                size="lg"
              />
            </div>
          )}
          {selected && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <div className="bg-primary text-primary-foreground rounded-full p-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 bg-card">
          <h3
            className="font-semibold text-xs tracking-wider text-center"
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
      <Skeleton className="aspect-[4/3] w-full rounded-t-lg" />
      <div className="p-3">
        <Skeleton className="h-3 w-3/4 mx-auto" />
      </div>
    </CardContent>
  </Card>
);

export const DnaSelectionDialog: FC<DnaSelectionDialogProps> = ({
  open,
  onOpenChange,
  selectedStyleId,
  onStyleSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: styles = [], isLoading } = useStyles(undefined, open);

  const filteredStyles = useMemo(
    () => filterStyles(styles, selectedCategory, searchQuery),
    [styles, selectedCategory, searchQuery]
  );

  const handleStyleSelect = useCallback(
    (styleId: string) => {
      onStyleSelect(styleId);
      onOpenChange(false);
    },
    [onStyleSelect, onOpenChange]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl">Visual Styles</DialogTitle>
          <DialogDescription>
            Choose a Director's DNA to define the visual style of your sequence
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4 border-b">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={handleClearSearch}
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((category) => (
              <Button
                key={category.id}
                variant={
                  selectedCategory === category.id ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  'rounded-full',
                  selectedCategory === category.id &&
                    'bg-primary text-primary-foreground'
                )}
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Styles Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }, (_, index) => (
                <StyleCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          ) : filteredStyles.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              data-testid="empty-state"
            >
              <div className="rounded-full bg-muted p-6 mb-4">
                <GalleryIcon className="text-muted-foreground" size="lg" />
              </div>
              <h3 className="text-lg font-medium mb-2">No styles found</h3>
              <p className="text-muted-foreground max-w-sm">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'There are currently no styles available'}
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              data-testid="dna-grid"
            >
              {filteredStyles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  selected={selectedStyleId === style.id}
                  onSelect={handleStyleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
