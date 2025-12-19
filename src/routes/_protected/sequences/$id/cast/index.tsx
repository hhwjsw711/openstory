import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { TalentView } from '@/components/talent/talent-view';
import { useUser } from '@/hooks/use-user';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/cast/')({
  component: CastPage,
});

function CastPage() {
  const { id: sequenceId } = Route.useParams();

  // Verify session
  useUser();

  return (
    <div className="flex h-full flex-col">
      <SequenceTabs sequenceId={sequenceId} />
      <div className="flex-1 overflow-hidden">
        <TalentView sequenceId={sequenceId} />
      </div>
    </div>
  );
}
