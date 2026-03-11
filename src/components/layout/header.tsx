/**
 * Header Component
 * Main navigation header with branding and user badge
 */

import { cn } from '@/lib/utils';
import { OpenStoryLogo } from '@/components/icons/openstory-logo';
import { Route as locationsRoute } from '@/routes/_protected/locations/index';
import { Route as sequencesRoute } from '@/routes/_protected/sequences/index';
import { Route as talentRoute } from '@/routes/_protected/talent/index';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CreditBalancePill } from './credit-balance-pill';
import { UserBadge } from './user-badge';
import { useLowBalanceWarning } from '@/hooks/use-low-balance-warning';
import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';

type HeaderProps = {
  className?: string;
};

const navLinks = [
  { to: sequencesRoute.to, label: 'Sequences' },
  { to: talentRoute.to, label: 'Talent' },
  { to: locationsRoute.to, label: 'Locations' },
] as const;

export function Header({ className }: HeaderProps) {
  useLowBalanceWarning();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between px-6">
        {/* Logo and navigation */}
        <div className="flex items-center gap-8">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSheetOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link to={sequencesRoute.to} className="flex items-center">
            <OpenStoryLogo size="md" />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-3">
          <CreditBalancePill />
          <UserBadge />
        </div>
      </div>

      {/* Mobile navigation sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-2 px-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setSheetOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
