/**
 * Auth Navigation Hook
 * React hook for navigating to auth pages with redirect preservation
 */

'use client';

import { getLoginUrl, getSignupUrl } from '@/lib/auth/navigation';
import { Route as loginRoute } from '@/routes/_auth/login';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

/**
 * Hook for auth navigation with redirect preservation
 * Automatically uses current pathname for redirect
 */
export function useAuthNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Navigate to login page, preserving current path for redirect
   * @param customPath - Optional custom path to redirect to (overrides current pathname)
   */
  const goToLogin = useCallback(
    (customPath?: string) => {
      const redirectTo = customPath || location.href;
      void navigate({
        to: loginRoute.fullPath,
        search: { redirectTo },
      });
    },
    [navigate, location.href]
  );

  /**
   * Navigate to signup page, preserving current path for redirect
   * @deprecated Use goToLogin instead - signup and signin are now unified
   * @param customPath - Optional custom path to redirect to (overrides current pathname)
   */
  const goToSignup = useCallback(
    (customPath?: string) => {
      // Signup is now the same as login - redirect to login page
      goToLogin(customPath);
    },
    [goToLogin]
  );

  /**
   * Get the login URL with redirect preservation (without navigating)
   * Useful for Link components
   */
  const loginUrl = getLoginUrl(location.pathname);

  /**
   * Get the signup URL with redirect preservation (without navigating)
   * @deprecated Use loginUrl instead - signup and signin are now unified
   * Useful for Link components
   */
  const signupUrl = getSignupUrl(location.pathname);

  return {
    goToLogin,
    goToSignup,
    loginUrl,
    signupUrl,
  };
}
