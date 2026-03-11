/**
 * Server-side authentication utilities for BetterAuth
 * Provides session management for Server Actions and API routes
 */

import { createIsomorphicFn, createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { authClient } from './client';
import { getAuth } from './config';

/**
 * Get the current session from server context
 * Works in Server Actions, API routes, and Server Components
 */
export const getSessionFn = createIsomorphicFn()
  .server(async () => {
    const headers = getRequestHeaders();
    const sessionData = await getAuth().api.getSession({
      headers: headers,
    });
    return sessionData;
  })
  .client(async () => {
    const { data: sessionData } = await authClient.getSession();

    return sessionData;
  });

/**
 * Get the current user from server context
 * Returns null if not authenticated
 */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await getAuth().api.getSession({
      headers: headers,
    });
    return session?.user;
  }
);

/**
 * Sign out the current user
 */
export const signOutFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const headers = getRequestHeaders();
    return getAuth().api.signOut({ headers: headers });
  }
);
