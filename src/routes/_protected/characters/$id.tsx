'use client';

import { EditCharacterDialog } from '@/components/character';
import { PageContainer } from '@/components/layout';
import {
  PageDescription,
  PageHeader,
  PageHeading,
} from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCharacterSheetRealtime } from '@/hooks/use-character-realtime';
import {
  useCharacter,
  useDeleteCharacter,
  useGenerateCharacterSheet,
  useToggleCharacterFavorite,
} from '@/hooks/use-characters';
import { cn } from '@/lib/utils';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ImageIcon,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
} from 'lucide-react';

export const Route = createFileRoute('/_protected/characters/$id')({
  component: CharacterDetailPage,
});

function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: character, isLoading, error } = useCharacter(id);
  const toggleFavorite = useToggleCharacterFavorite();
  const deleteCharacter = useDeleteCharacter();
  const generateSheet = useGenerateCharacterSheet();
  const { isGenerating: isGeneratingSheet, error: sheetError } =
    useCharacterSheetRealtime(id);

  const handleDelete = async () => {
    if (!character) return;
    if (!confirm(`Delete "${character.name}"? This cannot be undone.`)) return;

    await deleteCharacter.mutateAsync(character.id);
    navigate({ to: '/characters' });
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <PageContainer>
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </PageContainer>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="h-full overflow-auto">
        <PageContainer>
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">
              {error?.message || 'Character not found'}
            </p>
            <Button variant="outline" asChild>
              <Link to="/characters">Back to Characters</Link>
            </Button>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <PageContainer>
        {/* Back link */}
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/characters">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Characters
          </Link>
        </Button>

        <PageHeader
          actions={
            <div className="flex items-center gap-2">
              <EditCharacterDialog
                character={character}
                trigger={
                  <Button variant="outline" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleFavorite.mutate(character.id)}
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
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={deleteCharacter.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-3">
            <PageHeading>{character.name}</PageHeading>
            {character.isHumanGenerated && (
              <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
                Human
              </span>
            )}
          </div>
          {character.description && (
            <PageDescription>{character.description}</PageDescription>
          )}
        </PageHeader>

        {/* Character Sheets Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Character Sheets ({character.sheets.length})
            </h2>
            {character.media &&
              character.media.filter((m) => m.type === 'image').length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    generateSheet.mutate({ characterId: character.id })
                  }
                  disabled={generateSheet.isPending || isGeneratingSheet}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generateSheet.isPending || isGeneratingSheet
                    ? 'Generating…'
                    : 'Generate Sheet'}
                </Button>
              )}
          </div>

          {character.sheets.length === 0 ? (
            <Card className="p-8 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              {character.media &&
              character.media.filter((m) => m.type === 'image').length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-3">
                    {isGeneratingSheet
                      ? 'Generating character sheet from your reference images…'
                      : 'No character sheets yet. Generate one from your reference images.'}
                  </p>
                  {sheetError && (
                    <p className="text-destructive text-sm mb-3">
                      {sheetError}
                    </p>
                  )}
                  <Button
                    onClick={() =>
                      generateSheet.mutate({ characterId: character.id })
                    }
                    disabled={generateSheet.isPending || isGeneratingSheet}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generateSheet.isPending || isGeneratingSheet
                      ? 'Generating…'
                      : 'Generate Sheet'}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Upload reference images to generate a character sheet, or
                  sheets will be created when this character is used in a
                  sequence.
                </p>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {character.sheets.map((sheet) => (
                <Card
                  key={sheet.id}
                  className={cn(
                    'overflow-hidden',
                    sheet.isDefault && 'ring-2 ring-primary'
                  )}
                >
                  <div className="aspect-video bg-muted relative">
                    {sheet.imageUrl ? (
                      <img
                        src={sheet.imageUrl}
                        alt={sheet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Source badge */}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs">
                      {sheet.source === 'script_analysis' && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Script
                        </span>
                      )}
                      {sheet.source === 'ai_generated' && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </span>
                      )}
                      {sheet.source === 'manual_upload' && (
                        <span className="flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          Upload
                        </span>
                      )}
                    </div>

                    {/* Default badge */}
                    {sheet.isDefault && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium">
                        Default
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-1">
                      {sheet.name}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Media Section */}
        {character.media && character.media.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              Reference Media ({character.media.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {character.media.map((media) => (
                <Card key={media.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted">
                    {media.type === 'image' && (
                      <img
                        src={media.url}
                        alt="Reference"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {media.type === 'video' && (
                      <video
                        src={media.url}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </PageContainer>
    </div>
  );
}
