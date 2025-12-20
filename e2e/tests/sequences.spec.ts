/**
 * Sequences E2E Tests
 * Tests sequence creation and viewing flows
 */

import { test, expect } from '../fixtures/auth.fixture';

test.describe('Sequences', () => {
  test('can access sequences list page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/sequences');

    await expect(authenticatedPage).toHaveURL(/\/sequences/);
  });

  test('can access new sequence page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/sequences/new');

    await expect(authenticatedPage).toHaveURL('/sequences/new');
  });

  test('new sequence page has script input', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/sequences/new');

    // Should have some form of text input for the script
    const textarea = authenticatedPage.locator('textarea');
    await expect(textarea).toBeVisible();
  });
});
