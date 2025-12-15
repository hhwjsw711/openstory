/**
 * User Badge Component
 * Displays user authentication state with login/logout actions
 */

'use client';

import { LogOut, User } from 'lucide-react';
import { Route as sequencesRoute } from '@/routes/_protected/sequences/index';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/hooks/use-user';
import { authClient } from '@/lib/auth/client';

export function UserBadge() {
  const { data: user, isLoading } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Show loading state or no user data
  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  // Authenticated user - show user menu
  const userEmail = user.email;
  const displayName = user.fullName || userEmail || 'User';
  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Sign out - this should clear the session cookie
      // Note: Better Auth has a known issue (github.com/better-auth/better-auth/issues/3608)
      // where useSession doesn't update after server-side signOut until page refresh
      await authClient.signOut();

      // Force a full page reload to clear all client state
      // Use replace to prevent back button from returning to authenticated state
      window.location.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatarUrl || undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {userEmail && (
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={sequencesRoute.fullPath}>
            <User className="mr-2 h-4 w-4" />
            My Sequences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Get user initials from display name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    // Single name - use first 2 characters
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Multiple names - use first letter of first and last name
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
