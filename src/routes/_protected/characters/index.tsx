'use client';

import {
  CharacterDialog,
  CharacterFilters,
  CharactersList,
} from '@/components/character';
import { PageContainer } from '@/components/layout';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { EmptyState } from '@/components/ui/empty-state';
import { useCharacters } from '@/hooks/use-characters';
import { createFileRoute } from '@tanstack/react-router';
import { User } from 'lucide-react';
import { z } from 'zod';

const searchParamsSchema = z.object({
  filter: z.enum(['all', 'favorites']).optional().default('all'),
  sequenceId: z.string().optional(),
});

export const Route = createFileRoute('/_protected/characters/')({
  validateSearch: searchParamsSchema,
  component: CharactersPage,
});

function CharactersPage() {
  const { filter, sequenceId } = Route.useSearch();
  const {
    data: characters,
    isLoading,
    error,
  } = useCharacters({
    favoritesOnly: filter === 'favorites',
    sequenceId,
  });

  return (
    <div className="h-full overflow-auto">
      <PageContainer>
        <PageHeader actions={<CharacterDialog mode="create" />}>
          <PageHeading>Character Library</PageHeading>
          <PageDescription>
            Manage your team's character library for consistent AI-generated
            content.
          </PageDescription>
        </PageHeader>

        <CharacterFilters currentFilter={filter} />

        {!isLoading && characters && characters.length === 0 ? (
          <EmptyState
            icon={<User className="h-12 w-12" />}
            title="No characters yet"
            description="Add characters to your library to maintain visual consistency across your sequences."
            action={<CharacterDialog mode="create" />}
          />
        ) : (
          <CharactersList
            characters={characters}
            isLoading={isLoading}
            error={error}
          />
        )}
      </PageContainer>
    </div>
  );
}
