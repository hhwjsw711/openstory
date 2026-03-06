/**
 * Auth Fixture for E2E Tests
 *
 * Two modes:
 * 1. Stored auth (default): Uses pre-authenticated session from auth.setup.ts
 *    - Tests use `page` directly (already authenticated via storageState)
 *    - `testUser` reads stored user info from disk
 *
 * 2. Per-test auth (auth.spec.ts only): Creates new user for each test
 *    - Uses `authenticatedPage` fixture for fresh authentication
 */

import { test as base, type Page } from 'playwright/test';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import fs from 'node:fs';
import path from 'node:path';
import { testDb, ensureDbInit } from './db-client';
import {
  user,
  session,
  teams,
  teamMembers,
  verification,
} from '@/lib/db/schema';

type TestUser = {
  id: string;
  email: string;
  name: string;
  teamId: string;
};

const userInfoFile = path.join(import.meta.dirname, '../.auth/user-info.json');

/**
 * Read stored user info from auth.setup.ts
 * Used by tests running with storageState
 */
function getStoredUserInfo(): TestUser {
  if (!fs.existsSync(userInfoFile)) {
    throw new Error(
      'Stored user info not found. Run auth.setup.ts first or use authenticatedPage fixture.'
    );
  }
  return JSON.parse(fs.readFileSync(userInfoFile, 'utf-8'));
}

/**
 * Create a test user with team directly in the database
 */
async function createTestUser(): Promise<TestUser> {
  await ensureDbInit();
  const userId = ulid();
  const teamId = ulid();
  const now = new Date();

  const email = `test-${userId.slice(-8).toLowerCase()}@e2e.test`;
  const name = 'E2E Test User';
  const teamSlug = `test-team-${teamId.slice(-8).toLowerCase()}`;

  // Insert user with active status
  await testDb.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Insert team
  await testDb.insert(teams).values({
    id: teamId,
    name: 'E2E Test Team',
    slug: teamSlug,
    createdAt: now,
    updatedAt: now,
  });

  // Insert team membership
  await testDb.insert(teamMembers).values({
    teamId,
    userId,
    role: 'owner',
    joinedAt: now,
  });

  return { id: userId, email, name, teamId };
}

/**
 * Clean up test user and related data
 */
async function cleanupTestUser(userId: string, teamId: string): Promise<void> {
  await testDb.delete(session).where(eq(session.userId, userId));
  await testDb.delete(teamMembers).where(eq(teamMembers.userId, userId));
  await testDb.delete(teams).where(eq(teams.id, teamId));
  await testDb.delete(user).where(eq(user.id, userId));
}

/**
 * Create OTP verification record directly in database
 */
async function createOtpVerification(
  email: string,
  otp: string
): Promise<void> {
  const id = ulid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  // Better Auth uses sign-in-otp-{email} as identifier for sign-in OTP
  const identifier = `sign-in-otp-${email}`;
  // Value format is {otp}:{attempt_count}
  const value = `${otp}:0`;

  // Delete any existing verification for this email
  await testDb
    .delete(verification)
    .where(eq(verification.identifier, identifier));

  // Insert new verification record
  await testDb.insert(verification).values({
    id,
    identifier,
    value,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Authenticate a user by navigating directly to /verify and entering OTP
 */
async function authenticateUser(page: Page, email: string): Promise<void> {
  const testOtp = '123456';

  // Create OTP directly in database
  await createOtpVerification(email, testOtp);

  // Navigate directly to verify page with email
  await page.goto(`/verify?email=${encodeURIComponent(email)}`);

  // Wait for the OTP input to receive auto-focus from React's autoFocus prop.
  // This confirms React hydration is complete — before hydration, the input
  // element exists in SSR HTML but event handlers aren't attached yet.
  await page.waitForFunction(
    () => document.activeElement?.hasAttribute('data-input-otp'),
    { timeout: 30_000 }
  );

  // Clear and re-focus to ensure the controlled input is fully wired up.
  // Without this, the first keystroke can be swallowed by a React re-render.
  const otpInput = page.locator('input[data-input-otp]');
  await otpInput.fill('');
  await otpInput.focus();

  // Type the OTP with per-key delay so React processes each character via onChange
  // (auto-verifies when all 6 digits are entered)
  await page.keyboard.type(testOtp, { delay: 150 });

  // Wait for redirect away from verify page
  await page.waitForURL(
    (url) =>
      !url.pathname.includes('/login') && !url.pathname.includes('/verify'),
    { timeout: 30_000 }
  );
}

// Extended test with stored auth fixtures
// For tests using storageState (most tests):
// - `testUser` reads stored user info from disk
// - `page` is already authenticated via storageState config
export const test = base.extend<{
  testUser: TestUser;
  authenticatedPage: Page;
}>({
  // Default: read stored user info (for tests with storageState)
  // oxlint-disable-next-line no-empty-pattern -- Playwright fixture syntax requires empty object destructuring
  testUser: async ({}, use) => {
    const storedUser = getStoredUserInfo();
    await use(storedUser);
    // No cleanup needed - shared user persists across tests
  },

  // For auth.spec.ts: creates fresh user and authenticates per-test
  authenticatedPage: async ({ page }, use) => {
    const freshUser = await createTestUser();
    await authenticateUser(page, freshUser.email);
    await use(page);
    await cleanupTestUser(freshUser.id, freshUser.teamId);
  },
});

export { expect } from 'playwright/test';
