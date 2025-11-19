/**
 * BetterAuth configuration for Velro
 * Replaces Supabase Auth with anonymous users and email/password login
 */

import { db } from '@/lib/db/client';
import { generateId } from '@/lib/db/id';
import { account, session, user, verification } from '@/lib/db/schema';
import { APP_URL } from '@/lib/utils/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { isValidAccessCode } from './access-codes';

// Environment validation
const requiredEnvVars = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
} as const;

// Validate environment variables
// Note: TURSO_AUTH_TOKEN is optional for local development (file: URLs)
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
    },
  }),
  secret: requiredEnvVars.BETTER_AUTH_SECRET,
  baseURL: APP_URL,

  // Trusted origins for CSRF protection
  // Production uses custom domain, previews use Vercel URLs
  trustedOrigins: [APP_URL],

  // Session configuration
  // SECURITY: 90-day expiration mitigates:
  // - Session fixation attacks
  // - Database bloat from long-lived sessions
  // - GDPR compliance concerns
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days
    updateAge: 60 * 60 * 24, // Update session daily
    // Disable cookie cache to prevent sign-out issues
    // Cookie cache was causing sessions to persist after signOut()
    cookieCache: {
      enabled: false,
    },
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

      // Import dynamically to avoid issues during build
      const { sendPasswordResetEmail } = await import(
        '@/lib/services/email-service'
      );
      const result = await sendPasswordResetEmail(user.email, url);

      if (!result.success) {
        console.error('[BetterAuth] Failed to send reset email:', result.error);
        throw new Error('Failed to send password reset email');
      }

      console.log('[BetterAuth] Password reset email sent successfully');
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour (in seconds)
  },

  // Social providers
  // Google OAuth only enabled in production and local development
  // Preview branches use email/password or anonymous mode
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled:
        !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) &&
        (process.env.VERCEL_ENV === 'production' ||
          process.env.NODE_ENV === 'development'),
      // Disable sign-up via Google during closed beta
      // Existing users can sign in, but new accounts must use email/password with access code
      disableSignUp: true,
    },
  },

  // Configure plugins
  plugins: [
    // Next.js cookie integration
    nextCookies(),
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
    },
  },

  // Hooks for access code validation
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Only validate for signup endpoint
      if (ctx.path !== '/sign-up/email') {
        return;
      }

      const accessCode = ctx.body?.accessCode as string | undefined;

      // Validate access code
      if (!accessCode || !isValidAccessCode(accessCode)) {
        // throw new APIError('BAD_REQUEST', {
        //   message:
        //     'Valid access code required. Please enter a valid access code to sign up.',
        // });
      }

      // Normalize the code if provided
      if (accessCode && ctx.body) {
        ctx.body.accessCode = accessCode.toUpperCase().trim();
      }

      return { context: ctx };
    }),
    // No 'after' hook needed - Better Auth automatically stores additionalFields
    // when input: true (default). The accessCode field is defined in user.additionalFields
    // with input: true, so it's automatically persisted when passed in signup body.
  },

  // Advanced configuration
  advanced: {
    database: {
      // Generate ULID for user IDs (time-ordered, better performance)
      generateId: () => generateId(),
    },
  },
});

// Type inference for the auth instance with custom fields
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user & {
  teamId?: string | null;
  teamRole?: string | null;
  teamName?: string | null;
  teamSlug?: string | null;
};
