import { Skeleton } from '@/components/ui/skeleton';
import { useSequenceCharacters } from '@/hooks/use-sequence-characters';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { TalentCard } from './talent-card';
import { TalentDetailPanel } from './talent-detail-panel';

type TalentViewProps = {
  sequenceId: string;
};

export const TalentView: React.FC<TalentViewProps> = ({ sequenceId }) => {
  const {
    data: characters,
    isLoading,
    error,
  } = useSequenceCharacters(sequenceId);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  );

  const selectedCharacter =
    characters?.find((c) => c.id === selectedCharacterId) ?? null;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load characters</p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : !characters || characters.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-6">
              <Users className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-lg font-medium">No talent found</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Characters will appear here once your script has been analyzed.
                Add a script to your sequence to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {characters.map((character) => (
              <TalentCard
                key={character.id}
                character={character}
                isSelected={character.id === selectedCharacterId}
                onClick={() =>
                  setSelectedCharacterId(
                    character.id === selectedCharacterId ? null : character.id
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel - only show when character selected */}
      {selectedCharacter && (
        <div className="hidden w-80 shrink-0 md:block lg:w-96">
          <TalentDetailPanel
            character={selectedCharacter}
            onClose={() => setSelectedCharacterId(null)}
          />
        </div>
      )}
    </div>
  );
};
