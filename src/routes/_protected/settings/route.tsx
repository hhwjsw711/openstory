/**
 * Settings Layout Route
 * Provides tab navigation between settings sub-pages
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from '@tanstack/react-router';
import { ArrowLeft, Fingerprint, Key } from 'lucide-react';

export const Route = createFileRoute('/_protected/settings')({
  component: SettingsLayout,
});

const tabs = [
  {
    label: 'API Keys',
    href: '/settings/api-keys',
    icon: <Key className="h-4 w-4" />,
  },
  {
    label: 'Passkeys',
    href: '/settings/passkeys',
    icon: <Fingerprint className="h-4 w-4" />,
  },
];

function SettingsLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button variant="ghost" className="mb-4" asChild>
        <Link to="/sequences">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sequences
        </Link>
      </Button>

      <nav className="mb-6 flex items-center gap-2">
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

      <Outlet />
    </div>
  );
}
