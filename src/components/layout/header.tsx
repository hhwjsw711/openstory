/**
 * Header Component
 * Main navigation header with branding and user badge
 */

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { VelroLogo } from '@/components/icons';
import { UserBadge } from './user-badge';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
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
          <Link href="/sequences" className="flex items-center">
            <VelroLogo size="md" />
          </Link>

          {/* Main navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/sequences"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sequences
            </Link>
            <Link
              href="/sequences/new"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Create New
            </Link>
            <Link
              href="/eval"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Eval
            </Link>
          </nav>
        </div>

        {/* User badge */}
        <UserBadge />
      </div>
    </header>
  );
}
