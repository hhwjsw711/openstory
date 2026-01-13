import { LocationDetailView } from '@/components/locations/location-detail-view';
import { SequenceTabs } from '@/components/sequence/sequence-tabs';
import { useUser } from '@/hooks/use-user';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_protected/sequences/$id/locations/$locationId'
)({
  component: LocationDetailPage,
});

function LocationDetailPage() {
  const { id: sequenceId, locationId } = Route.useParams();

  // Verify session
  useUser();

  return (
    <div className="flex h-full flex-col">
      <SequenceTabs sequenceId={sequenceId} />
      <div className="flex-1 overflow-hidden">
        <LocationDetailView sequenceId={sequenceId} locationId={locationId} />
      </div>
    </div>
  );
}
