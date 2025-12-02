'use client';

import type React from 'react';
import { useState } from 'react';
import { EvalToolbar } from './eval-toolbar';
import { EvalMatrix } from './eval-matrix';
import {
  useSequencesWithFrames,
  type SequenceWithFrames,
} from '@/hooks/use-sequences-with-frames';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { VideoIcon } from 'lucide-react';

export type ViewMode = 'prompts' | 'images';

export type FilterState = {
  search: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  analysisModel: string | null;
  imageModel: string | null;
};

export type SortCriteria = {
  field: 'title' | 'createdAt' | 'analysisModel' | 'imageModel';
  direction: 'asc' | 'desc';
};

const defaultFilters: FilterState = {
  search: '',
  dateFrom: null,
  dateTo: null,
  analysisModel: null,
  imageModel: null,
};

export const EvalView: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('prompts');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([
    { field: 'createdAt', direction: 'desc' },
  ]);

  const { data: sequences, isLoading, error } = useSequencesWithFrames();

  // Apply filters and sorting
  const filteredAndSorted = applyFiltersAndSort(
    sequences || [],
    filters,
    sortCriteria
  );

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-40" />
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-24 w-64" />
                <Skeleton className="h-24 w-48" />
                <Skeleton className="h-24 w-48" />
                <Skeleton className="h-24 w-48" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">
          Failed to load sequences: {error.message}
        </p>
      </Card>
    );
  }

  if (!sequences || sequences.length === 0) {
    return (
      <EmptyState
        icon={<VideoIcon className="h-12 w-12" />}
        title="No sequences yet"
        description="Create some sequences to start evaluating prompts."
      />
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-4">
      <EvalToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filters={filters}
        onFiltersChange={setFilters}
        sortCriteria={sortCriteria}
        onSortChange={setSortCriteria}
      />
      {filteredAndSorted.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No sequences match your filters.
          </p>
        </Card>
      ) : (
        <EvalMatrix
          sequences={filteredAndSorted}
          showImages={viewMode === 'images'}
        />
      )}
    </div>
  );
};

function applyFiltersAndSort(
  sequences: SequenceWithFrames[],
  filters: FilterState,
  sortCriteria: SortCriteria[]
): SequenceWithFrames[] {
  let result = [...sequences];

  // Apply filters
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter((s) => s.title.toLowerCase().includes(searchLower));
  }

  if (filters.dateFrom) {
    result = result.filter((s) => new Date(s.createdAt) >= filters.dateFrom!);
  }

  if (filters.dateTo) {
    result = result.filter((s) => new Date(s.createdAt) <= filters.dateTo!);
  }

  if (filters.analysisModel) {
    result = result.filter((s) => s.analysisModel === filters.analysisModel);
  }

  if (filters.imageModel) {
    result = result.filter((s) => s.imageModel === filters.imageModel);
  }

  // Apply multi-criteria sort
  result.sort((a, b) => {
    for (const criteria of sortCriteria) {
      const aVal = a[criteria.field];
      const bVal = b[criteria.field];

      let cmp: number;
      if (criteria.field === 'createdAt') {
        cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else {
        cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
      }

      if (cmp !== 0) {
        return criteria.direction === 'asc' ? cmp : -cmp;
      }
    }
    return 0;
  });

  return result;
}
