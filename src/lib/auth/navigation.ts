/**
 * Authentication Navigation Utilities
 * Helpers for navigating to auth pages with redirect preservation
 */

/**
 * Build a login URL with redirect preservation
 * @param currentPath - Current path to redirect back to after login (default: current pathname)
 * @returns Login URL with redirectTo query param
 */
export function getLoginUrl(currentPath?: string): string {
  // Get current path from window if not provided (client-side only)
  const redirectTo =
    currentPath ||
    (typeof window !== 'undefined' ? window.location.pathname : '/sequences');

  // Only add redirectTo if it's not a default or auth route
  const isDefaultRoute = redirectTo === '/' || redirectTo === '/sequences';
  const isAuthRoute =
    redirectTo.startsWith('/login') || redirectTo.startsWith('/invite-code');

  if (isDefaultRoute || isAuthRoute) {
    return '/login';
  }

  const params = new URLSearchParams({ redirectTo });
  return `/login?${params.toString()}`;
}

/**
 * Build a signup URL with redirect preservation
 * @deprecated Use getLoginUrl instead - signup and signin are now unified
 * @param currentPath - Current path to redirect back to after signup (default: current pathname)
 * @returns Login URL with redirectTo query param
 */
export function getSignupUrl(currentPath?: string): string {
  // Signup is now the same as login - redirect to login page
  return getLoginUrl(currentPath);
}

/**
 * Navigate to login page with current path as redirect
 * For use in client components with Next.js router
 * @param router - Next.js router instance
 * @param currentPath - Optional path to redirect back to (defaults to current window.location.pathname)
 */
export function navigateToLogin(
  router: { push: (url: string) => void | Promise<void> },
  currentPath?: string
): void {
  const loginUrl = getLoginUrl(currentPath);
  router.push(loginUrl);
}

/**
 * Navigate to signup page with current path as redirect
 * @deprecated Use navigateToLogin instead - signup and signin are now unified
 * For use in client components with Next.js router
 * @param router - Next.js router instance
 * @param currentPath - Optional path to redirect back to (defaults to current window.location.pathname)
 */
export function navigateToSignup(
  router: { push: (url: string) => void | Promise<void> },
  currentPath?: string
): void {
  // Signup is now the same as login - redirect to login page
  navigateToLogin(router, currentPath);
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
        !redirectTo.startsWith('/login') &&
        !redirectTo.startsWith('/invite-code')
      ) {
        return redirectTo;
      }
    }
  }

  return '/sequences';
}
