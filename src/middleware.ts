/**
 * Next.js middleware for BetterAuth route protection
 * Requires authentication for all routes except login/signup
 *
 * EDGE RUNTIME COMPATIBLE (Cloudflare Workers, Vercel Edge, etc.)
 * - Uses cookie-based session validation (no Node.js APIs)
 * - Better Auth stores session token in 'better-auth.session_token' cookie
 * - Validates session by checking cookie presence (full validation in API routes)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Routes that unauthenticated users can access
const publicRoutes = ['/login', '/signup', '/forgot-password'];

// Better Auth session cookie name
// See: https://www.better-auth.com/docs/concepts/sessions
const SESSION_COOKIE_NAME = 'better-auth.session_token';

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

  // Check for session cookie (edge-compatible)
  // Better Auth stores the session token in a cookie
  // Full session validation happens in API routes
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = !!sessionToken;

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
  // Middleware automatically runs on Edge runtime in Next.js 15
  // No need to specify runtime explicitly
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
