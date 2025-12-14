'use client';

import { CharacterCard } from '@/components/character/character-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { LibraryCharacterWithSheets } from '@/lib/db/schema';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';

type CharactersListProps = {
  characters?: LibraryCharacterWithSheets[];
  isLoading?: boolean;
  error?: Error | null;
};

export const CharactersList: React.FC<CharactersListProps> = ({
  characters,
  isLoading,
  error,
}) => {
  const navigate = useNavigate();

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
        <p className="text-destructive mb-4">Failed to load characters</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Card>
    );
  }

  if (!characters || characters.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          onClick={() => navigate({ to: `/characters/${character.id}` })}
        />
      ))}
    </div>
  );
};
