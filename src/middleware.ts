/**
 * Next.js middleware for BetterAuth route protection
 * Requires authentication for all routes except login/signup
 */

import { auth } from '@/lib/auth/config';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Routes that unauthenticated users can access
const publicRoutes = ['/login', '/signup', '/forgot-password'];

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
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect authenticated users away from login/signup pages
  if (hasSession && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Require authentication for all routes except public routes
  if (!hasSession && !isPublicRoute) {
    // Preserve the original URL for redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow access to the route
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
