/**
 * Auth Fixture for E2E Tests
 * Creates OTP directly in database and navigates to /verify to bypass email sending
 */

import { test as base, type Page } from 'playwright/test';
import { createClient } from '@libsql/client';
import { ulid } from 'ulid';

/**
 * Get a database client for test operations
 * Creates a new client each time to avoid connection conflicts with the dev server
 */
function getClient() {
  return createClient({ url: 'file:test.db' });
}

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
  const now = Date.now();

  const email = `test-${userId.slice(-8).toLowerCase()}@e2e.test`;
  const name = 'E2E Test User';
  const teamSlug = `test-team-${teamId.slice(-8).toLowerCase()}`;

  const client = getClient();
  try {
    // Insert user with active status
    await client.execute({
      sql: `INSERT INTO user (id, name, email, email_verified, status, created_at, updated_at)
            VALUES (?, ?, ?, 1, 'active', ?, ?)`,
      args: [userId, name, email, now, now],
    });

    // Insert team
    await client.execute({
      sql: `INSERT INTO teams (id, name, slug, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        teamId,
        'E2E Test Team',
        teamSlug,
        Math.floor(now / 1000),
        Math.floor(now / 1000),
      ],
    });

    // Insert team membership
    await client.execute({
      sql: `INSERT INTO team_members (team_id, user_id, role, joined_at)
            VALUES (?, ?, 'owner', ?)`,
      args: [teamId, userId, Math.floor(now / 1000)],
    });
  } finally {
    client.close();
  }

  return { id: userId, email, name, teamId };
}

/**
 * Clean up test user and related data
 */
async function cleanupTestUser(userId: string, teamId: string): Promise<void> {
  const client = getClient();
  try {
    await client.execute({
      sql: 'DELETE FROM session WHERE user_id = ?',
      args: [userId],
    });
    await client.execute({
      sql: 'DELETE FROM team_members WHERE user_id = ?',
      args: [userId],
    });
    await client.execute({
      sql: 'DELETE FROM teams WHERE id = ?',
      args: [teamId],
    });
    await client.execute({
      sql: 'DELETE FROM user WHERE id = ?',
      args: [userId],
    });
  } finally {
    client.close();
  }
}

/**
 * Create OTP verification record directly in database
 */
async function createOtpVerification(
  email: string,
  otp: string
): Promise<void> {
  const id = ulid();
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes

  // Better Auth uses sign-in-otp-{email} as identifier for sign-in OTP
  const identifier = `sign-in-otp-${email}`;
  // Value format is {otp}:{attempt_count}
  const value = `${otp}:0`;

  const client = getClient();
  try {
    // Delete any existing verification for this email
    await client.execute({
      sql: 'DELETE FROM verification WHERE identifier = ?',
      args: [identifier],
    });

    // Insert new verification record
    await client.execute({
      sql: `INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, identifier, value, expiresAt, now, now],
    });
  } finally {
    client.close();
  }
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
