import { Card } from '@/components/ui/card';
import type { TeamLibraryLocation } from '@/hooks/use-sequence-locations';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

type LocationLibraryCardProps = {
  location: TeamLibraryLocation;
  isGenerating?: boolean;
  onClick?: () => void;
};

export const LocationLibraryCard: React.FC<LocationLibraryCardProps> = ({
  location,
  isGenerating = false,
  onClick,
}) => {
  const previewUrl = location.referenceImageUrl;

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {/* Preview image - 16:9 aspect ratio for locations */}
      <div className="aspect-video bg-muted relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={location.name}
            className={cn(
              'w-full h-full object-cover',
              isGenerating && 'opacity-50'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Type badge */}
        {location.type && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs font-medium capitalize">
            {location.type}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-4">
        <h3 className="font-semibold text-sm line-clamp-1 mb-1">
          {location.name}
        </h3>

        <p className="text-xs text-muted-foreground line-clamp-1">
          {location.sequenceTitle}
        </p>

        {location.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {location.description}
          </p>
        )}
      </div>
    </Card>
  );
};
