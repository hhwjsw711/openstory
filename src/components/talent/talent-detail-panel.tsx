import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Character } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { User, X } from 'lucide-react';

type TalentDetailPanelProps = {
  character: Character | null;
  onClose: () => void;
};

type DetailRowProps = {
  label: string;
  value: string | number | undefined;
  className?: string;
};

const DetailRow: React.FC<DetailRowProps> = ({ label, value, className }) => {
  if (!value) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed">{value}</dd>
    </div>
  );
};

export const TalentDetailPanel: React.FC<TalentDetailPanelProps> = ({
  character,
  onClose,
}) => {
  if (!character) {
    return (
      <div className="flex h-full flex-col border-l bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Character Details</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-center text-sm text-muted-foreground">
            Select a character to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">{character.name}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Character sheet image */}
          <div className="aspect-square overflow-hidden rounded-lg bg-muted">
            {character.sheetImageUrl ? (
              <img
                src={character.sheetImageUrl}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : character.sheetStatus === 'generating' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <Skeleton className="h-16 w-16 rounded-full" />
                <p className="text-xs text-muted-foreground">
                  Generating sheet…
                </p>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Character details */}
          <dl className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Age" value={character.age ?? undefined} />
              <DetailRow label="Gender" value={character.gender ?? undefined} />
            </div>

            <DetailRow
              label="Ethnicity"
              value={character.ethnicity ?? undefined}
            />

            <DetailRow
              label="Physical Description"
              value={character.physicalDescription ?? undefined}
            />

            <DetailRow
              label="Standard Clothing"
              value={character.standardClothing ?? undefined}
            />

            <DetailRow
              label="Distinguishing Features"
              value={character.distinguishingFeatures ?? undefined}
            />

            {/* First mention */}
            {character.firstMentionSceneId && (
              <div className="space-y-1 rounded-lg bg-muted/50 p-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  First Appears
                </dt>
                <dd className="text-sm">
                  Scene {character.firstMentionSceneId}
                  {character.firstMentionLine &&
                    `, Line ${character.firstMentionLine}`}
                </dd>
                {character.firstMentionText && (
                  <dd className="mt-2 border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground">
                    "{character.firstMentionText}"
                  </dd>
                )}
              </div>
            )}

            {/* Consistency tag (for developers/debugging) */}
            {character.consistencyTag && (
              <div className="pt-2">
                <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {character.consistencyTag}
                </span>
              </div>
            )}
          </dl>
        </div>
      </ScrollArea>
    </div>
  );
};
