/**
 * BetterAuth client configuration for React components
 * Provides client-side authentication methods and hooks
 */

import {
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { Auth } from './config';

// Create the auth client
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
});

// Export hooks and methods for easy use
export const {
  useSession,

  // useListSessions,
} = authClient;

// Type exports for TypeScript support
export type AuthClient = typeof authClient;
export type SessionData = typeof authClient.$Infer.Session;
