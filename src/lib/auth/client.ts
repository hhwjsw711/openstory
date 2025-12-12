/**
 * BetterAuth client configuration for React components
 * Provides client-side authentication methods and hooks
 */

import { NEXT_PUBLIC_APP_URL } from '@/lib/utils/environment';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { Auth } from './config';

// Create the auth client
export const authClient = createAuthClient({
  // Use centralized URL constant with runtime domain detection
  baseURL: NEXT_PUBLIC_APP_URL,
  plugins: [inferAdditionalFields<Auth>()],
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
