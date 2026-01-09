import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useNavigate } from '@tanstack/react-router';
import { Building, Home, LayoutGrid, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

type LocationLibraryFiltersProps = {
  currentFilter: 'all' | 'interior' | 'exterior';
  currentSearch?: string;
};

export const LocationLibraryFilters: React.FC<LocationLibraryFiltersProps> = ({
  currentFilter,
  currentSearch,
}) => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(currentSearch ?? '');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (currentSearch ?? '')) {
        void navigate({
          to: '/locations',
          search: {
            filter: currentFilter,
            search: searchValue || undefined,
          },
          replace: true,
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, currentSearch, currentFilter, navigate]);

  const handleFilterChange = (value: string) => {
    if (!value) return;
    void navigate({
      to: '/locations',
      search: {
        filter: value as 'all' | 'interior' | 'exterior',
        search: currentSearch,
      },
      replace: true,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search locations…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type filter */}
      <ToggleGroup
        type="single"
        value={currentFilter}
        onValueChange={handleFilterChange}
        className="justify-start"
      >
        <ToggleGroupItem value="all" aria-label="Show all locations">
          <LayoutGrid className="h-4 w-4 mr-2" />
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="interior" aria-label="Show interior locations">
          <Home className="h-4 w-4 mr-2" />
          Interior
        </ToggleGroupItem>
        <ToggleGroupItem value="exterior" aria-label="Show exterior locations">
          <Building className="h-4 w-4 mr-2" />
          Exterior
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
