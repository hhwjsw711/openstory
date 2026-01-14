/**
 * Server-side authentication utilities for BetterAuth
 * Provides session management for Server Actions and API routes
 */

import { getAuth } from './config';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

/**
 * Get the current session from server context
 * Works in Server Actions, API routes, and Server Components
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest();
    return getAuth().api.getSession({ headers: request.headers });
  }
);

/**
 * Get the current user from server context
 * Returns null if not authenticated
 */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest();
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    return session?.user;
  }
);

/**
 * Sign out the current user
 */
export const signOutFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest();
    return getAuth().api.signOut({ headers: request.headers });
  }
);
