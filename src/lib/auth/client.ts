/**
 * BetterAuth client configuration for React components
 * Provides client-side authentication methods and hooks
 */

import { anonymousClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Create the auth client with plugins
export const authClient = createAuthClient({
  // Use runtime domain detection to support multiple Vercel domains
  // This prevents CORS errors when accessing from preview deployments
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin // Use current domain in browser
      : process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000', // SSR fallback
  plugins: [anonymousClient()],
});

// Export hooks and methods for easy use
export const {
  useSession,
  signIn,
  signUp,
  signOut,
  // useListSessions,
} = authClient;

// Type exports for TypeScript support
export type AuthClient = typeof authClient;
export type SessionData = typeof authClient.$Infer.Session;
