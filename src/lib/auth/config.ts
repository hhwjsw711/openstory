/**
 * BetterAuth configuration for Velro
 * Replaces Supabase Auth with anonymous users and email/password login
 */

import { generateId } from '@/lib/db/id';
import { account, session, user, verification } from '@/lib/db/schema';
import {
  getProductionDeploymentAppUrl,
  getServerAppUrl,
  isProductionDeployment,
} from '@/lib/utils/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { getDb } from '#db-client';
import { getEnv } from '#env';
import { sendPasswordResetEmail } from '@/lib/services/email-service';

// Singleton auth instance cache
let _authInstance: ReturnType<typeof createAuth> | undefined;

/**
 * Create Better Auth instance
 * Separated for type inference - the return type is used for the singleton cache
 */
function createAuth(request: Request) {
  const runtimeEnv = getEnv();
  const skipStateCookie = !isProductionDeployment(request);
  console.log('[Auth Config] Creating auth instance', {
    getServerAppUrl: getServerAppUrl(request),
    getProductionDeploymentAppUrl: getProductionDeploymentAppUrl(request),
    isProduction: isProductionDeployment(request),
    skipStateCookieCheck: skipStateCookie,
  });

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema: {
        user: user,
        session: session,
        account: account,
        verification: verification,
      },
    }),
    secret: runtimeEnv.BETTER_AUTH_SECRET,
    // Trusted origins for CSRF protection and OAuth proxy

    // Session configuration
    // SECURITY: 90-day expiration mitigates:
    // - Session fixation attacks
    // - Database bloat from long-lived sessions
    // - GDPR compliance concerns
    session: {
      expiresIn: 60 * 60 * 24 * 90, // 90 days
      updateAge: 60 * 60 * 24, // Update session daily
    },

    // Account linking configuration
    // Allows users to link multiple authentication methods to one account
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'email-password'],
        allowDifferentEmails: false, // Only link accounts with matching emails
      },
      // Skip state cookie check for preview environments
      // Required because .vercel.app is on the Public Suffix List
      // and cookies cannot be shared across subdomains
      skipStateCookieCheck: !isProductionDeployment(request),
    },

    // Email and password authentication
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        console.log('[BetterAuth] Sending password reset email', {
          email: user.email,
          url,
        });

        const result = await sendPasswordResetEmail(user.email, url);

        if (!result.success) {
          console.error(
            '[BetterAuth] Failed to send reset email:',
            result.error
          );
          throw new Error('Failed to send password reset email');
        }

        console.log('[BetterAuth] Password reset email sent successfully');
      },
      resetPasswordTokenExpiresIn: 60 * 60, // 1 hour (in seconds)
    },

    // Social providers
    // Google OAuth enabled on all environments via oAuthProxy plugin
    // Preview branches proxy OAuth requests to production
    socialProviders: {
      google: {
        clientId: runtimeEnv.GOOGLE_CLIENT_ID,
        clientSecret: runtimeEnv.GOOGLE_CLIENT_SECRET,
        enabled: true,
      },
    },

    // Configure plugins
    plugins: [
      // Next.js cookie integration
      tanstackStartCookies(),
    ],

    // Custom user fields to match existing schema, This is BetterAuth user table.
    user: {
      additionalFields: {
        fullName: {
          type: 'string',
          required: false,
        },
        avatarUrl: {
          type: 'string',
          required: false,
        },
        onboardingCompleted: {
          type: 'boolean',
          required: false,
          defaultValue: false,
        },
        accessCode: {
          type: 'string',
          required: false,
        },
        status: {
          type: 'string',
          required: false,
          defaultValue: 'pending' as const,
        },
      },
    },

    // Advanced configuration
    advanced: {
      database: {
        // Generate ULID for user IDs (time-ordered, better performance)
        generateId: () => generateId(),
      },
    },
  });
}

/**
 * Get or create Better Auth instance (singleton)
 * Compatible with Cloudflare Workers where env is request-scoped
 */
export function getAuth(request: Request) {
  return (_authInstance ??= createAuth(request));
}
// Type inference for the auth instance with custom fields
export type Auth = ReturnType<typeof getAuth>;
export type Session = ReturnType<typeof getAuth>['$Infer']['Session'];
export type User = ReturnType<typeof getAuth>['$Infer']['Session']['user'];
