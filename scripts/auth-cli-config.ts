/**
 * Better Auth CLI configuration
 * Minimal auth instance for schema generation.
 *
 * Uses client-local directly because the auth CLI loads this file
 * via jiti, which doesn't resolve the #db-client conditional import
 * correctly (always picks the web client instead of local).
 *
 * Usage: bun auth:generate
 */

import { getDb } from '@/lib/db/client-local';
import { generateId } from '@/lib/db/id';
import { account, passkey, session, user, verification } from '@/lib/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, lastLoginMethod } from 'better-auth/plugins';
import { passkey as passkeyPlugin } from '@better-auth/passkey';

export default betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'sqlite',
    schema: { user, session, account, verification, passkey },
  }),
  secret: 'cli-only',
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOTP: async () => {},
    }),
    lastLoginMethod(),
    passkeyPlugin(),
  ],
  user: {
    additionalFields: {
      status: {
        type: 'string',
        required: false,
        defaultValue: 'active' as const,
      },
    },
  },
  advanced: { database: { generateId: () => generateId() } },
});
