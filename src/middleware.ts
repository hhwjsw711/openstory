import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

// Define route patterns
const authRoutes = ["/login", "/signup"];
const protectedRoutes = ["/dashboard", "/sequences", "/teams"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes (except auth), and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/) ||
    (pathname.startsWith("/api") && !pathname.startsWith("/api/v1/auth"))
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Create Supabase client for middleware
    const supabase = createMiddlewareClient(request, response);

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Route protection logic
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    // Redirect unauthenticated users from protected routes
    if (isProtectedRoute && !session) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect authenticated users away from auth pages
    if (isAuthRoute && session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  } catch (error) {
    // If there's an error with Supabase (e.g., network issues),
    // allow the request to continue for public routes
    console.error("Middleware error:", error);

    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route),
    );

    if (isProtectedRoute) {
      // Redirect to login if we can't verify auth for protected routes
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
