/**
 * BetterAuth configuration for Velro
 * Replaces Supabase Auth with anonymous users and email/password login
 */

import { generateId } from '@/lib/db/id';
import { account, session, user, verification } from '@/lib/db/schema';
import {
  APP_URL,
  PRODUCTION_DEPLOYMENT_APP_URL,
} from '@/lib/utils/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { oAuthProxy } from 'better-auth/plugins';

import { getDb } from '#db-client';
import { getEnv } from '#env';
import { sendPasswordResetEmail } from '@/lib/services/email-service';

// Singleton auth instance cache
let _authInstance: ReturnType<typeof betterAuth> | undefined;

/**
 * Get or create Better Auth instance
 * This function initializes the database connection lazily when first called,
 * making it compatible with Cloudflare Workers where env is request-scoped
 */
export function getAuth() {
  if (_authInstance) {
    return _authInstance;
  }

  const runtimeEnv = getEnv();
  console.log('[Auth Config] Creating auth instance with lazy initialization');

  // getDb() is now called during request handling, not module initialization
  _authInstance = betterAuth({
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
    baseURL: APP_URL,

    // Trusted origins for CSRF protection and OAuth proxy
    // Wildcard patterns allow OAuth proxy to redirect from production to preview branches
    trustedOrigins: [
      APP_URL,
      'http://localhost:3000', // Local development (for OAuth proxy redirect)
      'https://*.velro.ai',
      'https://*.vercel.app',
      'https://*.railway.app',
      'https://app.velro.ai', // Production
      'https://*.velro.workers.dev', // All Cloudflare Pages previews
    ],

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
        // Redirect URI required for oAuthProxy to work on preview branches
        redirectURI: `${PRODUCTION_DEPLOYMENT_APP_URL}/api/auth/callback/google`,
        // Sign-up enabled - access code validation happens after auth via activation flow
      },
    },

    // Configure plugins
    plugins: [
      // Next.js cookie integration
      nextCookies(),
      // OAuth Proxy for preview deployments
      oAuthProxy({
        currentURL: APP_URL,
        productionURL: PRODUCTION_DEPLOYMENT_APP_URL,
      }),
    ],
    crossSubDomainCookies: {
      enabled: true,
      domain: '.velro.ai',
    },

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
          defaultValue: 'pending',
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

  return _authInstance;
}

// Type inference for the auth instance with custom fields
export type Auth = ReturnType<typeof getAuth>;
export type Session = ReturnType<typeof getAuth>['$Infer']['Session'];
export type User = ReturnType<typeof getAuth>['$Infer']['Session']['user'] & {
  teamId?: string | null;
  teamRole?: string | null;
  teamName?: string | null;
  teamSlug?: string | null;
};
