/**
 * Locations E2E Tests
 * Tests location library management including reference media uploads
 */

import { test, expect } from 'playwright/test';
import { test as testWithUser } from '../fixtures/auth.fixture';
import { setupMockRoutes } from '../mocks/handlers';
import {
  createTestLibraryLocation,
  cleanupLocationById,
  type TestLibraryLocation,
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

// Tests create locations via UI - use unique names to avoid collisions in parallel
testWithUser.describe('Add Location with Reference Media', () => {
  testWithUser.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
  });

  testWithUser('can open Add Location dialog', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    // Click the Add Location button (header or empty state - use first available)
    const addButton = page
      .getByRole('button', { name: 'Add Location' })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(addButton).toBeEnabled();
    await addButton.click();

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

  testWithUser(
    'can create location without media',
    async ({ page, testUser }) => {
      const uniqueName = `E2E Test Location ${Date.now()}`;

      await page.goto('/locations');
      await page.waitForLoadState('networkidle');
      await page.getByRole('heading', { name: 'Location Library' }).waitFor();

      // Click Add Location button (header or empty state - use first available)
      const addButton = page
        .getByRole('button', { name: 'Add Location' })
        .first();
      await expect(addButton).toBeVisible({ timeout: 10000 });
      await expect(addButton).toBeEnabled();
      await addButton.click();

      // Wait for dialog to open
      await page.getByLabel('Name').waitFor({ timeout: 10000 });
      await page.getByLabel('Name').fill(uniqueName);
      await page.getByLabel('Description').fill('Test description for E2E');

      // Click the submit button inside the dialog
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Add Location' })
        .click();

      await expect(
        page.getByRole('dialog', { name: 'Add Location' })
      ).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByText(uniqueName)).toBeVisible({
        timeout: 10000,
      });

      // Cleanup: find and delete the created location
      const { testDb } = await import('../fixtures/db-client');
      const { locationLibrary } = await import('@/lib/db/schema');
      const { eq, and } = await import('drizzle-orm');
      const [created] = await testDb
        .select({ id: locationLibrary.id })
        .from(locationLibrary)
        .where(
          and(
            eq(locationLibrary.teamId, testUser.teamId),
            eq(locationLibrary.name, uniqueName)
          )
        );
      if (created) {
        await cleanupLocationById(created.id);
      }
    }
  );

  testWithUser(
    'can create location with reference media',
    async ({ page, testUser }) => {
      const uniqueName = `E2E Test Location With Media ${Date.now()}`;

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
      await page.getByLabel('Name').fill(uniqueName);
      await page
        .getByLabel('Description')
        .fill('Location with reference images');

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

      await expect(page.getByText(uniqueName)).toBeVisible({
        timeout: 10000,
      });

      // Cleanup: find and delete the created location
      const { testDb } = await import('../fixtures/db-client');
      const { locationLibrary } = await import('@/lib/db/schema');
      const { eq, and } = await import('drizzle-orm');
      const [created] = await testDb
        .select({ id: locationLibrary.id })
        .from(locationLibrary)
        .where(
          and(
            eq(locationLibrary.teamId, testUser.teamId),
            eq(locationLibrary.name, uniqueName)
          )
        );
      if (created) {
        await cleanupLocationById(created.id);
      }
    }
  );

  testWithUser('can cancel Add Location dialog', async ({ page }) => {
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
// Each test creates its own data with unique names for parallel execution
testWithUser.describe('Edit Location', () => {
  let testLocation: TestLibraryLocation;

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);
    testLocation = await createTestLibraryLocation(
      testUser.teamId,
      `E2E Edit Test Location ${Date.now()}`
    );
  });

  testWithUser.afterEach(async () => {
    await cleanupLocationById(testLocation.id);
  });

  testWithUser('can view location detail page', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await page.getByRole('heading', { name: testLocation.name }).click();

    await expect(
      page.getByRole('heading', { name: testLocation.name })
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

      await page.getByRole('heading', { name: testLocation.name }).click();

      await page.locator('button:has(svg.lucide-pencil)').first().click();

      await expect(
        page.getByRole('dialog', { name: 'Edit Location' })
      ).toBeVisible();

      await expect(page.getByLabel('Name')).toHaveValue(testLocation.name);
    }
  );

  testWithUser('can cancel edit dialog without saving', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();
    await page.getByRole('heading', { name: testLocation.name }).click();

    await page.locator('button:has(svg.lucide-pencil)').first().click();

    await page.getByLabel('Name').fill('Should Not Be Saved');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('dialog', { name: 'Edit Location' })
    ).not.toBeVisible();

    await expect(
      page.getByRole('heading', { name: testLocation.name })
    ).toBeVisible();
  });
});

// Each test creates its own data with unique names for parallel execution
testWithUser.describe('Location Library - List View', () => {
  let testLocationAlpha: TestLibraryLocation;
  let testLocationBeta: TestLibraryLocation;

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);
    const suffix = Date.now();
    testLocationAlpha = await createTestLibraryLocation(
      testUser.teamId,
      `E2E Location Alpha ${suffix}`
    );
    testLocationBeta = await createTestLibraryLocation(
      testUser.teamId,
      `E2E Location Beta ${suffix}`
    );
  });

  testWithUser.afterEach(async () => {
    await cleanupLocationById(testLocationAlpha.id);
    await cleanupLocationById(testLocationBeta.id);
  });

  testWithUser('displays multiple locations in grid', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('heading', { name: 'Location Library' }).waitFor();

    await expect(
      page.getByRole('heading', { name: testLocationAlpha.name })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: testLocationBeta.name })
    ).toBeVisible();
  });

  testWithUser(
    'can navigate between location detail pages',
    async ({ page }) => {
      await page.goto('/locations');
      await page.getByRole('heading', { name: 'Location Library' }).waitFor();

      await page.getByRole('heading', { name: testLocationAlpha.name }).click();
      await expect(
        page.getByRole('heading', { name: testLocationAlpha.name })
      ).toBeVisible();

      await page.getByRole('link', { name: 'Back to Locations' }).click();
      await expect(page).toHaveURL(/\/locations(\?|$)/);

      await page.getByRole('heading', { name: testLocationBeta.name }).click();
      await expect(
        page.getByRole('heading', { name: testLocationBeta.name })
      ).toBeVisible();
    }
  );
});
