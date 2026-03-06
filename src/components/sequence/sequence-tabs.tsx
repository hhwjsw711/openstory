import { Link, useMatchRoute } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { FileText, Film, Grid3X3, MapPin, Music, Users } from 'lucide-react';

type SequenceTabsProps = {
  sequenceId: string;
};

type TabItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export const SequenceTabs: React.FC<SequenceTabsProps> = ({ sequenceId }) => {
  const matchRoute = useMatchRoute();

  const tabs: TabItem[] = [
    {
      label: 'Script',
      href: `/sequences/${sequenceId}/script`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: 'Scenes',
      href: `/sequences/${sequenceId}/scenes`,
      icon: <Grid3X3 className="h-4 w-4" />,
    },
    {
      label: 'Cast',
      href: `/sequences/${sequenceId}/cast`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Locations',
      href: `/sequences/${sequenceId}/locations`,
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: 'Music',
      href: `/sequences/${sequenceId}/music`,
      icon: <Music className="h-4 w-4" />,
    },
    {
      label: 'Theatre',
      href: `/sequences/${sequenceId}/theatre`,
      icon: <Film className="h-4 w-4" />,
    },
  ];

  return (
    <nav className="flex items-center gap-2 py-2">
      {tabs.map((tab) => {
        const isActive = matchRoute({ to: tab.href, fuzzy: false });

        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};
