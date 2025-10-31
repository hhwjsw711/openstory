'use client';

import { DnaGrid } from '@/components/dna/dna-grid';
import { GalleryIcon } from '@/components/icons/gallery-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { filterStyles } from '@/lib/utils/style-filters';
import type { Style } from '@/types/database';
import { Search, X } from 'lucide-react';
import type { ChangeEvent, FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

type DnaSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styles?: Style[];
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
};

export const DnaSelectionDialog: FC<DnaSelectionDialogProps> = ({
  open,
  onOpenChange,
  styles,
  selectedStyleId,
  onStyleSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const isLoading = styles === undefined;
  // List out all the categories
  const categories = useMemo(() => {
    return isLoading
      ? undefined
      : [
          'all',
          ...Object.keys(
            styles.reduce(
              (acc, style) => {
                if (style.category) {
                  acc[style.category] = style.category;
                }
                return acc;
              },
              {} as Record<string, string>
            )
          ),
        ];
  }, [styles, isLoading]);

  const filteredStyles = useMemo(
    () => filterStyles(styles ?? [], selectedCategory, searchQuery),
    [styles, selectedCategory, searchQuery]
  );

  const handleOk = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleOk();
    },
    [handleOk]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[95vw] flex-col sm:max-w-[95vw] lg:max-w-[90vw] xl:max-w-[85vw]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Director's DNA</DialogTitle>
            <DialogDescription>
              Choose the visual style of your sequence
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Search */}
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <InputGroupAddon align="inline-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearSearch}
                  >
                    <X />
                    <span className="sr-only">Clear search</span>
                  </Button>
                </InputGroupAddon>
              )}
            </InputGroup>

            {/* Category Filters */}
            <ToggleGroup
              type="single"
              value={selectedCategory}
              onValueChange={(value) => value && setSelectedCategory(value)}
              className="flex-wrap justify-start"
            >
              {categories?.map((category) => (
                <ToggleGroupItem
                  key={category}
                  value={category}
                  className="rounded-full"
                >
                  {category}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Styles Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto ">
            {filteredStyles.length === 0 && !isLoading ? (
              <Empty data-testid="empty-state">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GalleryIcon size="lg" />
                  </EmptyMedia>
                  <EmptyTitle>No styles found</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery || selectedCategory !== 'all'
                      ? 'Try adjusting your filters or search query'
                      : 'There are currently no styles available'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DnaGrid
                styles={filteredStyles}
                selectedStyleId={selectedStyleId}
                onStyleSelect={onStyleSelect}
                onStyleSelectAndClose={handleStyleSelect}
                isLoading={isLoading}
              />
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="submit">OK</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
