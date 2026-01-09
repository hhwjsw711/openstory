import { AddLocationDialog } from '@/components/location-library/add-location-dialog';
import { LocationLibraryFilters } from '@/components/location-library/location-library-filters';
import { LocationLibraryList } from '@/components/location-library/location-library-list';
import { PageContainer } from '@/components/layout/page-container';
import { PageDescription } from '@/components/typography/page-description';
import { PageHeader } from '@/components/typography/page-header';
import { PageHeading } from '@/components/typography/page-heading';
import { EmptyState } from '@/components/ui/empty-state';
import { useTeamLocationsLibrary } from '@/hooks/use-sequence-locations';
import { createFileRoute } from '@tanstack/react-router';
import { MapPin } from 'lucide-react';
import { z } from 'zod';

const searchParamsSchema = z.object({
  filter: z.enum(['all', 'interior', 'exterior']).optional().default('all'),
  search: z.string().optional(),
});

export const Route = createFileRoute('/_protected/locations/')({
  validateSearch: searchParamsSchema,
  component: LocationsPage,
});

function LocationsPage() {
  const { filter, search } = Route.useSearch();
  const { data: locations, isLoading, error } = useTeamLocationsLibrary();

  // Filter locations based on search params
  const filteredLocations = locations?.filter((loc) => {
    // Filter by type
    if (filter === 'interior' && loc.type !== 'interior') return false;
    if (filter === 'exterior' && loc.type !== 'exterior') return false;

    // Filter by search query
    if (search) {
      const query = search.toLowerCase();
      return (
        loc.name.toLowerCase().includes(query) ||
        loc.description?.toLowerCase().includes(query) ||
        loc.sequenceTitle.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="h-full overflow-auto">
      <PageContainer>
        <PageHeader actions={<AddLocationDialog />}>
          <PageHeading>Location Library</PageHeading>
          <PageDescription>
            Browse and manage location references across all your sequences.
            Upload custom references to maintain visual consistency.
          </PageDescription>
        </PageHeader>

        <LocationLibraryFilters currentFilter={filter} currentSearch={search} />

        {!isLoading && filteredLocations && filteredLocations.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-12 w-12" />}
            title="No locations yet"
            description="Locations will appear here once they're extracted from your sequence scripts, or you can add custom locations to your library."
            action={<AddLocationDialog />}
          />
        ) : (
          <LocationLibraryList
            locations={filteredLocations}
            isLoading={isLoading}
            error={error}
          />
        )}
      </PageContainer>
    </div>
  );
}
