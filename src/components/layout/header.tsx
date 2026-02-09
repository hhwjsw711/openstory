/**
 * Header Component
 * Main navigation header with branding and user badge
 */

import { cn } from '@/lib/utils';
import { VelroLogo } from '@/components/icons/velro-logo';
import { Route as locationsRoute } from '@/routes/_protected/locations/index';
import { Route as sequencesRoute } from '@/routes/_protected/sequences/index';
import { Route as talentRoute } from '@/routes/_protected/talent/index';
import { CreditBalancePill } from './credit-balance-pill';
import { UserBadge } from './user-badge';
import { useLowBalanceWarning } from '@/hooks/use-low-balance-warning';
import { Link } from '@tanstack/react-router';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  useLowBalanceWarning();

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and navigation */}
        <div className="flex items-center gap-8">
          <Link to={sequencesRoute.fullPath} className="flex items-center">
            <VelroLogo size="md" />
          </Link>

          {/* Main navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to={sequencesRoute.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sequences
            </Link>
            <Link
              to={talentRoute.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Talent
            </Link>
            <Link
              to={locationsRoute.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Locations
            </Link>
          </nav>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-3">
          <CreditBalancePill />
          <UserBadge />
        </div>
      </div>
    </header>
  );
}
