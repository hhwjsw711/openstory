/**
 * Sequences E2E Tests
 * Tests sequence creation and viewing flows
 */

import { test, expect } from 'playwright/test';

test.describe('Sequences', () => {
  test('can access sequences list page', async ({ page }) => {
    await page.goto('/sequences');

    await expect(page).toHaveURL(/\/sequences/);
  });

  test('can access new sequence page', async ({ page }) => {
    await page.goto('/sequences/new');

    await expect(page).toHaveURL('/sequences/new');
  });

  test('new sequence page has script input', async ({ page }) => {
    await page.goto('/sequences/new');

    // Should have some form of text input for the script
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
  });
});
