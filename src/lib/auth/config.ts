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
import { createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { getDb } from '#db-client';
import { getEnv } from '#env';
import { sendPasswordResetEmail } from '@/lib/services/email-service';
import { generatePreviewTransferToken, isPreviewUrl } from './preview-transfer';

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

    // Trusted origins for CSRF protection
    // Allow preview deployments to initiate OAuth via /api/auth/preview-oauth
    trustedOrigins: [
      // Production origins
      'https://app.velro.ai',
      'https://cf.velro.ai',
      'https://r.velro.ai',
      'https://v.velro.ai',
      'https://velro.up.railway.app',
      'https://velro-prd.vercel.app',
      // Preview patterns - Better Auth supports wildcards
      'https://*.velro.workers.dev',
      'https://*.velro.ai',
      'https://velro-*.vercel.app',
      // Local development
      'http://localhost:3000',
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
    // Google OAuth enabled on all environments
    // Preview branches pass additionalData through OAuth state
    // and redirect back via signed JWT (see hooks.after below)
    socialProviders: {
      google: {
        clientId: runtimeEnv.GOOGLE_CLIENT_ID,
        clientSecret: runtimeEnv.GOOGLE_CLIENT_SECRET,
        enabled: true,
        // Force callback to production URL (preview → production, localhost → localhost)
        // This ensures Google always redirects to a registered callback URL
        redirectURI: `${getProductionDeploymentAppUrl(request)}/api/auth/callback/google`,
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

    // Hooks for preview branch OAuth transfer
    // When OAuth completes on production, redirect to preview with signed JWT
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        // Only handle OAuth callback paths
        if (!ctx.path.startsWith('/callback/')) {
          return;
        }

        // Get OAuth state which includes additionalData from client
        const oauthState = await getOAuthState();

        // additionalData is spread on the state object
        const previewUrl = oauthState?.previewUrl as string | undefined;

        // Check if this is a preview transfer request
        if (!previewUrl || !isPreviewUrl(previewUrl)) {
          return; // Not a preview transfer, continue normal flow
        }

        // Extract callbackUrl from additionalData (or use state's callbackURL)
        const callbackUrl =
          (oauthState?.callbackUrl as string | undefined) ||
          oauthState?.callbackURL ||
          '/sequences';

        const newSession = ctx.context.newSession;
        if (!newSession?.user) {
          console.warn('[Preview Transfer] No new session found in callback');
          return;
        }

        console.log('[Preview Transfer] Intercepting OAuth callback', {
          userId: newSession.user.id,
          previewUrl,
        });

        // Generate transfer token with user info
        const token = await generatePreviewTransferToken({
          userId: newSession.user.id,
          email: newSession.user.email,
          name: newSession.user.name,
          image: newSession.user.image ?? undefined,
          previewUrl,
          callbackUrl,
        });

        // Build redirect URL to preview's callback endpoint
        const redirectUrl = new URL('/api/auth/preview-callback', previewUrl);
        redirectUrl.searchParams.set('token', token);

        console.log('[Preview Transfer] Redirecting to preview', {
          url: redirectUrl.toString(),
        });

        // Override response with redirect to preview
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectUrl.toString(),
          },
        });
      }),
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
