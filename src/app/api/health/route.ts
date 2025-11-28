/**
 * Health check endpoint
 * Reports system variables for debugging deployment issues
 */

import {
  APP_URL,
  getDeploymentPlatform,
  PRODUCTION_DEPLOYMENT_APP_URL,
} from '@/lib/utils/environment';
import { NextResponse } from 'next/server';

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
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV || 'not set',
      vercelUrl: process.env.VERCEL_URL || 'not set',
      vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || 'not set',

      // Cloudflare-specific
      cfPages: process.env.CF_PAGES || 'not set',
      cfPagesUrl: process.env.CF_PAGES_URL || 'not set',
      cfPagesBranch: process.env.CF_PAGES_BRANCH || 'not set',

      // Railway-specific
      railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'not set',
      railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || 'not set',

      // Node environment
      nodeEnv: process.env.NODE_ENV || 'not set',
    },
    urls: {
      appUrl: APP_URL,
      explicitAppUrl: process.env.APP_URL || 'not set',
      productionDeploymentAppUrl: PRODUCTION_DEPLOYMENT_APP_URL,
    },
    auth: {
      baseUrl: APP_URL, // This is what Better Auth uses
    },
    database: {
      tursoUrl: process.env.TURSO_DATABASE_URL || 'not set',
    },
    storage: {
      r2AccountId: process.env.R2_ACCOUNT_ID || 'not set',
      r2BucketName: process.env.R2_BUCKET_NAME || 'not set',
      r2AccessKeyId: sanitize(process.env.R2_ACCESS_KEY_ID),
    },
  };

  return NextResponse.json(health, { status: 200 });
}
