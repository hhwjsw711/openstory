/**
 * Health check endpoint
 * Reports system variables for debugging deployment issues
 */

import { createFileRoute } from '@tanstack/react-router';
import { getEnv } from '#env';
import {
  getDeploymentPlatform,
  getProductionDeploymentAppUrl,
  getServerAppUrl,
  isProductionDeployment,
} from '@/lib/utils/environment';
import { getAuth } from '@/lib/auth/config';

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Sanitize function to hide sensitive values
        const sanitize = (value: string | undefined): string => {
          if (!value) return '<not set>';
          if (value.length > 50) {
            // Show first 10 and last 10 characters for long values (like tokens)
            return `${value.substring(0, 10)}...${value.substring(value.length - 10)}`;
          }
          return value;
        };

        const env = getEnv();
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          platform: getDeploymentPlatform(),

          deployment: {
            // Vercel-specific
            vercel: env.VERCEL,
            vercelEnv: env.VERCEL_ENV || 'not set',
            vercelUrl: env.VERCEL_URL || 'not set',
            vercelGitCommitRef: env.VERCEL_GIT_COMMIT_REF || 'not set',

            // Cloudflare-specific
            cfPages: env.CF_PAGES || 'not set',
            cfPagesUrl: env.CF_PAGES_URL || 'not set',
            cfPagesBranch: env.CF_PAGES_BRANCH || 'not set',

            // Railway-specific
            railwayEnv: env.RAILWAY_ENVIRONMENT || 'not set',
            railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN || 'not set',

            // Node environment
            nodeEnv: env.NODE_ENV || 'not set',
          },
          urls: {
            getServerAppUrl: getServerAppUrl(request),
            getProductionDeploymentAppUrl:
              getProductionDeploymentAppUrl(request),
            isProductionDeployment: isProductionDeployment(request),
            explicitAppUrl: env.APP_URL || 'not set',
            PRODUCTION_DEPLOYMENT_APP_URL:
              env.PRODUCTION_DEPLOYMENT_APP_URL || 'not set',
          },
          auth: {
            auth: getAuth(), // This is what Better Auth uses
          },
          database: {
            tursoUrl: env.TURSO_DATABASE_URL || 'not set',
          },
          storage: {
            r2AccountId: env.R2_ACCOUNT_ID || 'not set',
            r2BucketName: env.R2_BUCKET_NAME || 'not set',
            r2AccessKeyId: sanitize(env.R2_ACCESS_KEY_ID),
          },
        };

        return Response.json(health, { status: 200 });
      },
    },
  },
});
