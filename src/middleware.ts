/**
 * Next.js middleware for BetterAuth route protection
 * Lightweight middleware for Velro's anonymous-first approach
 */

import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Routes that require full authentication (not anonymous)
const authRequiredRoutes = ['/settings', '/billing'];

// Routes that authenticated users should skip
const authOnlyRoutes = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check for BetterAuth session using direct API access
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const hasSession = !!session;
  const isAnonymous = session?.user?.isAnonymous ?? true;

  // For Velro's anonymous-first approach:
  // - Allow access to most routes without authentication
  // - Only protect truly sensitive routes (settings, billing)
  // - Let components handle showing upgrade prompts for anonymous users

  // Redirect authenticated (non-anonymous) users away from auth pages
  const isAuthOnlyRoute = authOnlyRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (hasSession && !isAnonymous && isAuthOnlyRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Protect sensitive routes that require full authentication (not anonymous)
  const isAuthRequired = authRequiredRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isAuthRequired && (!hasSession || isAnonymous)) {
    // Preserve the original URL for redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow all other routes - anonymous users can create sequences
  return NextResponse.next();
}

export const config = {
  runtime: 'nodejs', // Required for direct API access with auth.api.getSession
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (BetterAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
