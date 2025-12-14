/**
 * Authentication Navigation Utilities
 * Helpers for navigating to auth pages with redirect preservation
 */

import { Route as inviteCodeRoute } from '@/routes/_auth/invite-code';
import { Route as loginRoute } from '@/routes/_auth/login';
import { Route as sequencesRoute } from '@/routes/_protected/sequences/index';

/**
 * Build a login URL with redirect preservation
 * @param currentPath - Current path to redirect back to after login (default: current pathname)
 * @returns Login URL with redirectTo query param
 */
function getLoginUrl(currentPath?: string): string {
  // Get current path from window if not provided (client-side only)
  const redirectTo =
    currentPath ||
    (typeof window !== 'undefined'
      ? window.location.pathname
      : sequencesRoute.fullPath);

  // Only add redirectTo if it's not a default or auth route
  const isDefaultRoute =
    redirectTo === '/' || redirectTo === sequencesRoute.fullPath;
  const isAuthRoute =
    redirectTo.startsWith(loginRoute.fullPath) ||
    redirectTo.startsWith(inviteCodeRoute.fullPath);

  if (isDefaultRoute || isAuthRoute) {
    return loginRoute.fullPath;
  }

  const params = new URLSearchParams({ redirectTo });
  return `${loginRoute.fullPath}?${params.toString()}`;
}

/**
 * Build a signup URL with redirect preservation
 * @deprecated Use getLoginUrl instead - signup and signin are now unified
 * @param currentPath - Current path to redirect back to after signup (default: current pathname)
 * @returns Login URL with redirectTo query param
 */
function getSignupUrl(currentPath?: string): string {
  // Signup is now the same as login - redirect to login page
  return getLoginUrl(currentPath);
}

/**
 * Navigate to login page with current path as redirect
 * For use in client components with TanStack Router
 * @param navigate - TanStack Router navigate function
 * @param currentPath - Optional path to redirect back to (defaults to current window.location.pathname)
 */
function navigateToLogin(
  navigate: (options: { to: string; search?: { redirectTo?: string } }) => void,
  currentPath?: string
): void {
  const redirectTo =
    currentPath ||
    (typeof window !== 'undefined'
      ? window.location.href
      : sequencesRoute.fullPath);
  navigate({
    to: loginRoute.fullPath,
    search: { redirectTo },
  });
}

/**
 * Navigate to signup page with current path as redirect
 * @deprecated Use navigateToLogin instead - signup and signin are now unified
 * For use in client components with TanStack Router
 * @param navigate - TanStack Router navigate function
 * @param currentPath - Optional path to redirect back to (defaults to current window.location.pathname)
 */
function navigateToSignup(
  navigate: (options: { to: string; search?: { redirectTo?: string } }) => void,
  currentPath?: string
): void {
  // Signup is now the same as login - redirect to login page
  navigateToLogin(navigate, currentPath);
}

/**
 * Get the redirect URL from query params
 * For use in auth pages to read the intended destination
 * @param searchParams - URLSearchParams or query params object
 * @returns Redirect path or default (/sequences)
 */
export function getRedirectFromParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): string {
  let redirectTo: string | null = null;

  if (searchParams instanceof URLSearchParams) {
    redirectTo = searchParams.get('redirectTo');
  } else if (typeof searchParams === 'object' && searchParams.redirectTo) {
    const value = searchParams.redirectTo;
    redirectTo = Array.isArray(value) ? value[0] : value;
  }

  // Validate redirect URL to prevent open redirects
  if (redirectTo) {
    // Only allow relative URLs (starting with /)
    if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      // Prevent redirecting back to auth pages
      if (
        !redirectTo.startsWith(loginRoute.fullPath) &&
        !redirectTo.startsWith(inviteCodeRoute.fullPath)
      ) {
        return redirectTo;
      }
    }
  }

  return sequencesRoute.fullPath;
}
