import { Card } from '@/components/ui/card';
import type { Character } from '@/lib/db/schema';
import { User } from 'lucide-react';

type TalentCardProps = {
  character: Character;
};

export const TalentCard: React.FC<TalentCardProps> = ({ character }) => {
  const imageUrl = character.sheetImageUrl;

  return (
    <Card className="group relative cursor-pointer overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-primary/50">
      {/* Character avatar - cropped from right side of sheet where large headshot lives */}
      <div className="aspect-square bg-muted relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={character.name}
            className="h-full w-full object-cover"
            style={{
              // The character sheet is 16:9 with a large headshot on the right side
              // Crop to the right ~25% and lower ~60% where the headshot panel is
              objectPosition: '95% 75%',
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Sheet status indicator */}
        {character.sheetStatus === 'generating' && (
          <div className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Generating…
          </div>
        )}
      </div>

      {/* Character name */}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{character.name}</h3>
        {character.gender && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {character.age && `${character.age}, `}
            {character.gender}
          </p>
        )}
      </div>
    </Card>
  );
};
