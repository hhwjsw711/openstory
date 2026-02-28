/**
 * Auth Setup - Runs once before all tests to create authenticated session
 * Saves both browser state (cookies) and user info to disk for reuse
 */

import { test as setup } from 'playwright/test';
import { ulid } from 'ulid';
import { eq } from 'drizzle-orm';
import { testDb, ensureDbInit } from '../fixtures/db-client';
import { user, teams, teamMembers, verification } from '@/lib/db/schema';
import fs from 'node:fs';
import path from 'node:path';

const authDir = path.join(import.meta.dirname, '../.auth');
const authFile = path.join(authDir, 'user.json');
const userInfoFile = path.join(authDir, 'user-info.json');

type StoredUserInfo = {
  id: string;
  email: string;
  name: string;
  teamId: string;
};

setup('authenticate', async ({ page }) => {
  // Ensure DB is configured (WAL mode, busy_timeout) before any writes
  await ensureDbInit();

  // Ensure .auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Use unique IDs to avoid conflicts with existing data
  const userId = ulid();
  const teamId = ulid();
  const now = new Date();

  // Unique email per run to avoid needing cleanup
  const email = `e2e-${userId.slice(-8).toLowerCase()}@e2e.test`;
  const name = 'E2E Shared User';
  const teamSlug = `e2e-team-${teamId.slice(-8).toLowerCase()}`;

  // Insert user
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
    name: 'E2E Shared Team',
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

  // Create OTP verification
  const testOtp = '123456';
  const identifier = `sign-in-otp-${email}`;
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  await testDb
    .delete(verification)
    .where(eq(verification.identifier, identifier));

  await testDb.insert(verification).values({
    id: ulid(),
    identifier,
    value: `${testOtp}:0`,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  // Navigate to verify page and enter OTP
  await page.goto(`/verify?email=${encodeURIComponent(email)}`);
  await page.waitForSelector('[data-slot]', { timeout: 5000 });
  await page.keyboard.type(testOtp);

  // Wait for redirect away from verify page
  await page.waitForURL(
    (url) =>
      !url.pathname.includes('/login') && !url.pathname.includes('/verify'),
    { timeout: 30000 }
  );

  // Save browser state
  await page.context().storageState({ path: authFile });

  // Save user info
  const userInfo: StoredUserInfo = { id: userId, email, name, teamId };
  fs.writeFileSync(userInfoFile, JSON.stringify(userInfo, null, 2));
});
