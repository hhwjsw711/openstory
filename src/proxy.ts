/**
 * Next.js middleware for BetterAuth route protection
 * Optimistically checks for session cookie presence (not secure validation)
 * Actual session validation happens in protected layout
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  //
  // Note: We manually read the cookie instead of using better-auth/cookies
  // helpers to avoid Edge Runtime dynamic code evaluation restrictions.
  // Better Auth's default cookie format is: ${prefix}.${cookie_name}
  // Default prefix: "better-auth", default cookie name: "session_token"

  const sessionCookie =
    request.cookies.get('__Secure-better-auth.session_token') ||
    request.cookies.get('better-auth.session_token');

  if (!sessionCookie) {
    // Preserve the original URL for redirect after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match /sequences and all sub-routes
     * Examples: /sequences, /sequences/123, /sequences/123/scenes
     */
    '/sequences/:path*',
  ],
};
