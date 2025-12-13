'use client';
import { ScenesView } from '@/components/scenes/scenes-view';
import { useUser } from '@/hooks/use-user';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/scenes')({
  component: ScenesPage,
});

function ScenesPage() {
  const { id: sequenceId } = Route.useParams();

  // Verify session
  useUser();

  return (
    <div className="h-full">
      <ScenesView sequenceId={sequenceId} />
    </div>
  );
}
