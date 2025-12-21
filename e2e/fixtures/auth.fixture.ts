/**
 * Auth Fixture for E2E Tests
 * Creates OTP directly in database and navigates to /verify to bypass email sending
 */

import { test as base, type Page } from 'playwright/test';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { testDb } from './db-client';
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

/**
 * Create a test user with team directly in the database
 */
async function createTestUser(): Promise<TestUser> {
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

  // Wait for OTP input to appear
  await page.waitForSelector('[data-slot]', { timeout: 5000 });

  // Type the OTP (auto-verifies when all 6 digits are entered)
  await page.keyboard.type(testOtp);

  // Wait for redirect away from verify page
  await page.waitForURL(
    (url) =>
      !url.pathname.includes('/login') && !url.pathname.includes('/verify'),
    { timeout: 15000 }
  );
}

// Extended test with authenticated page fixture
export const test = base.extend<{
  authenticatedPage: Page;
  testUser: TestUser;
}>({
  testUser: async ({}, use) => {
    const user = await createTestUser();
    await use(user);
    await cleanupTestUser(user.id, user.teamId);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await authenticateUser(page, testUser.email);
    await use(page);
  },
});

export { expect } from 'playwright/test';
