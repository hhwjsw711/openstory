import { LocationDetailView } from '@/components/locations/location-detail-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_protected/sequences/$id/locations/$locationId'
)({
  component: LocationDetailPage,
});

function LocationDetailPage() {
  const { id: sequenceId, locationId } = Route.useParams();

  return <LocationDetailView sequenceId={sequenceId} locationId={locationId} />;
}
