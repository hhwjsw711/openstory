import { TheatreView } from '@/components/theatre/theatre-view';
import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useSequence } from '@/hooks/use-sequences';
import { useUser } from '@/hooks/use-user';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/theatre')({
  component: TheatrePage,
});

function TheatrePage() {
  const { id: sequenceId } = Route.useParams();

  useUser();

  const { data: sequence, isLoading } = useSequence(sequenceId);

  if (isLoading || !sequence) {
    return (
      <div className="flex h-full flex-col">
        <SequenceTabs sequenceId={sequenceId} />
        <div className="flex-1 p-4">
          <Skeleton className="aspect-video w-full max-w-4xl mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SequenceTabs sequenceId={sequenceId} />
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <TheatreView sequence={sequence} />
        </div>
      </div>
    </div>
  );
}
