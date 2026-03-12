import { CharacterDetailView } from '@/components/talent/character-detail-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_protected/sequences/$id/cast/$characterId'
)({
  component: CharacterDetailPage,
});

function CharacterDetailPage() {
  const { id: sequenceId, characterId } = Route.useParams();

  return (
    <CharacterDetailView sequenceId={sequenceId} characterId={characterId} />
  );
}
