import { TalentLibraryCard } from '@/components/talent-library/talent-library-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTalentSheetsRealtime } from '@/hooks/use-talent-sheets-realtime';
import type { TalentWithSheets } from '@/lib/db/schema';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';

type TalentLibraryListProps = {
  talent?: TalentWithSheets[];
  isLoading?: boolean;
  error?: Error | null;
};

export const TalentLibraryList: React.FC<TalentLibraryListProps> = ({
  talent,
  isLoading,
  error,
}) => {
  const navigate = useNavigate();

  // Subscribe to realtime events for all talent
  const talentIds = talent?.map((t) => t.id) ?? [];
  const { isGenerating } = useTalentSheetsRealtime(talentIds);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="overflow-hidden animate-pulse">
            <div className="aspect-square bg-muted" />
            <div className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive mb-4">Failed to load talent</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Card>
    );
  }

  if (!talent || talent.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {talent.map((t) => (
        <TalentLibraryCard
          key={t.id}
          talent={t}
          isGenerating={isGenerating(t.id)}
          onClick={() => void navigate({ to: `/talent/${t.id}` })}
        />
      ))}
    </div>
  );
};
