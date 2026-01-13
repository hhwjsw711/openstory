/**
 * Locations E2E Tests
 * Tests location library management including reference media uploads
 */

import { test, expect } from 'playwright/test';
import { test as testWithUser } from '../fixtures/auth.fixture';
import { setupMockRoutes } from '../mocks/handlers';
import {
  createTestLibraryLocation,
  cleanupTestLocations,
} from '../fixtures/location.fixture';
import path from 'node:path';

test.describe('Location Library', () => {
  test('can access locations page', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await expect(page).toHaveURL(/\/locations/);
    await expect(
      page.getByRole('heading', { name: 'Location Library' })
    ).toBeVisible();
  });

  test('shows empty state when no locations exist', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await expect(page.getByText('No locations yet')).toBeVisible();
  });

  test('has Add Location button', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    const addButton = page.getByRole('button', {
      name: 'Add Location',
    });
    await expect(addButton.first()).toBeVisible();
    await expect(addButton.first()).toBeEnabled();
  });
});

test.describe('Add Location with Reference Media', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
  });

  test('can open Add Location dialog', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    // Wait for hydration - the empty state button appears after page loads
    const emptyStateButton = page
      .getByRole('button', { name: 'Add Location' })
      .nth(1);
    await expect(emptyStateButton).toBeVisible({ timeout: 10000 });
    await expect(emptyStateButton).toBeEnabled();
    await emptyStateButton.click();

    await expect(
      page.getByRole('dialog', { name: 'Add Location' })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    // Reference Images label and Browse files button should be present
    await expect(
      page.getByRole('button', { name: 'Browse files' })
    ).toBeVisible();
  });

  test('can create location without media', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    // Use the empty state button (nth(1)) as header button has click issues
    const addButton = page.getByRole('button', { name: 'Add Location' }).nth(1);
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    // Wait for dialog to open
    await page.getByLabel('Name').waitFor({ timeout: 10000 });
    await page.getByLabel('Name').fill('E2E Test Location');
    await page.getByLabel('Description').fill('Test description for E2E');

    // Click the submit button inside the dialog
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add Location' })
      .click();

    await expect(
      page.getByRole('dialog', { name: 'Add Location' })
    ).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText('E2E Test Location')).toBeVisible({
      timeout: 10000,
    });
  });

  test('can create location with reference media', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    const addButton = page
      .getByRole('button', { name: 'Add Location' })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    // Wait for dialog to open
    await page.getByLabel('Name').waitFor({ timeout: 10000 });
    await page.getByLabel('Name').fill('E2E Test Location With Media');
    await page.getByLabel('Description').fill('Location with reference images');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse files' }).click();
    const fileChooser = await fileChooserPromise;

    const testImagePath = path.join(
      import.meta.dirname,
      '../fixtures/test-image.jpg'
    );
    await fileChooser.setFiles(testImagePath);

    // Click the submit button inside the dialog
    const submitButton = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add Location' });
    await expect(submitButton).toBeEnabled({ timeout: 15000 });
    await submitButton.click();

    await expect(
      page.getByRole('dialog', { name: 'Add Location' })
    ).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText('E2E Test Location With Media')).toBeVisible({
      timeout: 10000,
    });
  });

  test('can cancel Add Location dialog', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    const addButton = page
      .getByRole('button', { name: 'Add Location' })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(
      page.getByRole('dialog', { name: 'Add Location' })
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('dialog', { name: 'Add Location' })
    ).not.toBeVisible();
  });
});

// Tests that need testUser for creating test data
testWithUser.describe('Edit Location', () => {
  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);
    await createTestLibraryLocation(testUser.teamId, 'E2E Edit Test Location');
  });

  testWithUser.afterEach(async ({ testUser }) => {
    await cleanupTestLocations(testUser.teamId);
  });

  testWithUser('can view location detail page', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await page.getByRole('heading', { name: 'E2E Edit Test Location' }).click();

    await expect(
      page.getByRole('heading', { name: 'E2E Edit Test Location' })
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Reference Images' })
    ).toBeVisible();
  });

  testWithUser(
    'can open edit dialog from location detail page',
    async ({ page }) => {
      await page.goto('/locations');
      await page.getByRole('heading', { name: 'Location Library' }).waitFor();

      await page
        .getByRole('heading', { name: 'E2E Edit Test Location' })
        .click();

      await page.locator('button:has(svg.lucide-pencil)').first().click();

      await expect(
        page.getByRole('dialog', { name: 'Edit Location' })
      ).toBeVisible();

      await expect(page.getByLabel('Name')).toHaveValue(
        'E2E Edit Test Location'
      );
    }
  );

  testWithUser('can cancel edit dialog without saving', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();
    await page.getByRole('heading', { name: 'E2E Edit Test Location' }).click();

    await page.locator('button:has(svg.lucide-pencil)').first().click();

    await page.getByLabel('Name').fill('Should Not Be Saved');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('dialog', { name: 'Edit Location' })
    ).not.toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'E2E Edit Test Location' })
    ).toBeVisible();
  });
});

testWithUser.describe('Location Library - List View', () => {
  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);
    await createTestLibraryLocation(testUser.teamId, 'E2E Location Alpha');
    await createTestLibraryLocation(testUser.teamId, 'E2E Location Beta');
  });

  testWithUser.afterEach(async ({ testUser }) => {
    await cleanupTestLocations(testUser.teamId);
  });

  testWithUser('displays multiple locations in grid', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await expect(
      page.getByRole('heading', { name: 'E2E Location Alpha' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'E2E Location Beta' })
    ).toBeVisible();
  });

  testWithUser(
    'can navigate between location detail pages',
    async ({ page }) => {
      await page.goto('/locations');
      await page.getByRole('heading', { name: 'Location Library' }).waitFor();

      await page.getByRole('heading', { name: 'E2E Location Alpha' }).click();
      await expect(
        page.getByRole('heading', { name: 'E2E Location Alpha' })
      ).toBeVisible();

      await page.getByRole('link', { name: 'Back to Locations' }).click();
      await expect(page).toHaveURL(/\/locations(\?|$)/);

      await page.getByRole('heading', { name: 'E2E Location Beta' }).click();
      await expect(
        page.getByRole('heading', { name: 'E2E Location Beta' })
      ).toBeVisible();
    }
  );
});
