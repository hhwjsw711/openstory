/**
 * Health check endpoint
 * Reports system variables for debugging deployment issues
 */

import { env } from '#env';
import { APP_URL, getDeploymentPlatform } from '@/lib/utils/environment';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  // Sanitize function to hide sensitive values
  const sanitize = (value: string | undefined): string => {
    if (!value) return '<not set>';
    if (value.length > 50) {
      // Show first 10 and last 10 characters for long values (like tokens)
      return `${value.substring(0, 10)}...${value.substring(value.length - 10)}`;
    }
    return value;
  };

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: getDeploymentPlatform(),
    deployment: {
      // Vercel-specific
      vercel: !!env.VERCEL,
      vercelEnv: env.VERCEL_ENV || '<not set>',
      vercelUrl: env.VERCEL_URL || '<not set>',
      vercelGitCommitRef: env.VERCEL_GIT_COMMIT_REF || '<not set>',

      // Cloudflare-specific
      cfPages: env.CF_PAGES || '<not set>',
      cfPagesUrl: env.CF_PAGES_URL || '<not set>',
      cfPagesBranch: env.CF_PAGES_BRANCH || '<not set>',

      // Railway-specific
      railwayEnv: env.RAILWAY_ENVIRONMENT || '<not set>',
      railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN || '<not set>',

      // Node environment
      nodeEnv: env.NODE_ENV || '<not set>',
    },
    urls: {
      appUrl: APP_URL,
      explicitAppUrl: env.APP_URL || '<not set>',
    },
    auth: {
      betterAuthSecret: sanitize(env.BETTER_AUTH_SECRET),
      baseUrl: APP_URL, // This is what Better Auth uses
    },
    database: {
      tursoUrl: env.TURSO_DATABASE_URL || '<not set>',
      tursoToken: sanitize(env.TURSO_AUTH_TOKEN),
    },
    storage: {
      r2AccountId: env.R2_ACCOUNT_ID || '<not set>',
      r2BucketName: env.R2_BUCKET_NAME || '<not set>',
      r2AccessKeyId: sanitize(env.R2_ACCESS_KEY_ID),
    },
  };

  return NextResponse.json(health, { status: 200 });
}
