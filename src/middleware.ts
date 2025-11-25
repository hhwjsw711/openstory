/**
 * Next.js middleware for BetterAuth route protection
 * Optimistically checks for session cookie presence (not secure validation)
 * Actual session validation happens in protected layout
 */

import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    // Preserve the original URL for redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    /*
     * Match /sequences and all sub-routes
     * Examples: /sequences, /sequences/123, /sequences/123/scenes
     */
    '/sequences/:path*',
  ],
};
