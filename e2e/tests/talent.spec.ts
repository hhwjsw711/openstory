/**
 * Talent E2E Tests
 * Tests talent library management
 */

import { test, expect } from '../fixtures/auth.fixture';

test.describe('Talent Library', () => {
  test('can access talent page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // URL may include filter param
    await expect(authenticatedPage).toHaveURL(/\/talent/);
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Talent Library' })
    ).toBeVisible();
  });

  test('shows empty state when no talent exists', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');

    // Check for empty state text
    await expect(authenticatedPage.getByText('No talent yet')).toBeVisible();
  });

  test('has Add Talent button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // Verify Add Talent button exists (in header)
    const addButton = authenticatedPage.getByRole('button', {
      name: 'Add Talent',
    });
    await expect(addButton.first()).toBeVisible();
    await expect(addButton.first()).toBeEnabled();
  });
});
