import { TheatreView } from '@/components/theatre/theatre-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useSequence } from '@/hooks/use-sequences';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sequences/$id/theatre')({
  component: TheatrePage,
});

function TheatrePage() {
  const { id: sequenceId } = Route.useParams();

  const { data: sequence, isLoading } = useSequence(sequenceId, {
    refetchInterval: (query) => {
      if (query.state.data?.mergedVideoStatus === 'merging') return 2000;
      return false;
    },
  });

  if (isLoading || !sequence) {
    return (
      <div className="flex-1 p-4">
        <Skeleton className="aspect-video w-full max-w-4xl mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        <TheatreView sequence={sequence} />
      </div>
    </div>
  );
}
