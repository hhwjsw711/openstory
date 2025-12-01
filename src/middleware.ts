/**
 * Next.js middleware for:
 * 1. Canonical URL redirect (redirect to APP_URL if not on canonical domain)
 * 2. BetterAuth route protection (optimistic session cookie check)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/utils/environment';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHost = request.headers.get('host') || '';

  // 1. Canonical URL redirect (skip for localhost)
  if (!requestHost.includes('localhost')) {
    const canonical = new URL(APP_URL);
    if (requestHost !== canonical.host) {
      const redirectUrl = new URL(request.url);
      redirectUrl.host = canonical.host;
      redirectUrl.protocol = canonical.protocol;
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  // 2. Auth check for protected routes
  // THIS IS NOT SECURE! This is optimistic - actual validation happens in protected layout.
  // Note: We manually read the cookie instead of using better-auth/cookies
  // helpers to avoid Edge Runtime dynamic code evaluation restrictions.
  if (pathname.startsWith('/sequences')) {
    const sessionCookie = request.cookies.get('better-auth.session_token');
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All routes except static assets and API
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
