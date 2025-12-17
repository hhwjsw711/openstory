import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToggleCharacterFavorite } from '@/hooks/use-characters';
import type { CharacterWithSheets } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { ImageIcon, Star, User } from 'lucide-react';
import type React from 'react';

type CharacterCardProps = {
  character: CharacterWithSheets;
  onClick?: () => void;
};

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onClick,
}) => {
  const toggleFavorite = useToggleCharacterFavorite();
  // Prefer character headshot (square), fall back to default sheet
  const previewUrl = character.imageUrl ?? character.defaultSheet?.imageUrl;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(character.id);
  };

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {/* Preview image */}
      <div className="aspect-square bg-muted relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Favorite button overlay */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            character.isFavorite && 'opacity-100'
          )}
          onClick={handleFavoriteClick}
          disabled={toggleFavorite.isPending}
        >
          <Star
            className={cn(
              'h-4 w-4',
              character.isFavorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        </Button>

        {/* Human/AI badge */}
        {character.isHumanGenerated && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs font-medium">
            Human
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-4">
        <h3 className="font-semibold text-base line-clamp-1 mb-1">
          {character.name}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            <span>
              {character.sheetCount} sheet{character.sheetCount !== 1 && 's'}
            </span>
          </div>
        </div>

        {character.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {character.description}
          </p>
        )}
      </div>
    </Card>
  );
};
