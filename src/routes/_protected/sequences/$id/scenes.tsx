import { ScenesView } from '@/components/scenes/scenes-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/scenes')({
  component: ScenesPage,
});

function ScenesPage() {
  const { id: sequenceId } = Route.useParams();

  return <ScenesView sequenceId={sequenceId} />;
}
