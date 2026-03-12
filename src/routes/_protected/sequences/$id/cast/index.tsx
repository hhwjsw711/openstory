import { TalentView } from '@/components/talent/talent-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/cast/')({
  component: CastPage,
});

function CastPage() {
  const { id: sequenceId } = Route.useParams();

  return <TalentView sequenceId={sequenceId} />;
}
