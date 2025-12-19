import { CharacterDetailView } from '@/components/talent/character-detail-view';
import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { useUser } from '@/hooks/use-user';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_protected/sequences/$id/cast/$characterId'
)({
  component: CharacterDetailPage,
});

function CharacterDetailPage() {
  const { id: sequenceId, characterId } = Route.useParams();

  // Verify session
  useUser();

  return (
    <div className="flex h-full flex-col">
      <SequenceTabs sequenceId={sequenceId} />
      <div className="flex-1 overflow-auto">
        <CharacterDetailView
          sequenceId={sequenceId}
          characterId={characterId}
        />
      </div>
    </div>
  );
}
