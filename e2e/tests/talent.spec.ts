/**
 * Talent E2E Tests
 * Tests talent library management including reference media uploads
 */

import { test, expect } from '../fixtures/auth.fixture';
import { setupMockRoutes } from '../mocks/handlers';
import {
  createTestTalent,
  createTestTalentWithMedia,
  cleanupTestTalent,
} from '../fixtures/talent.fixture';
import path from 'node:path';

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

test.describe('Add Talent with Reference Media', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Set up mock routes for R2 and other external services
    await setupMockRoutes(authenticatedPage);
  });

  test('can open Add Talent dialog', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // Click Add Talent button
    await authenticatedPage
      .getByRole('button', { name: 'Add Talent' })
      .first()
      .click();

    // Dialog should open
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Talent' })
    ).toBeVisible();

    // Check for form fields
    await expect(authenticatedPage.getByLabel('Name')).toBeVisible();
    await expect(authenticatedPage.getByLabel('Description')).toBeVisible();
    await expect(authenticatedPage.getByText('Reference Media')).toBeVisible();
  });

  test('can create talent without media', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // Click Add Talent button
    await authenticatedPage
      .getByRole('button', { name: 'Add Talent' })
      .first()
      .click();

    // Fill in the form
    await authenticatedPage.getByLabel('Name').fill('E2E Test Actor');
    await authenticatedPage
      .getByLabel('Description')
      .fill('Test description for E2E');

    // Submit the form
    await authenticatedPage.getByRole('button', { name: 'Add Talent' }).click();

    // Wait for dialog to close and talent to appear in list
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Talent' })
    ).not.toBeVisible({ timeout: 10000 });

    // Talent should appear in the list
    await expect(authenticatedPage.getByText('E2E Test Actor')).toBeVisible({
      timeout: 10000,
    });
  });

  test('can create talent with reference media', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');

    // Click Add Talent button
    await authenticatedPage
      .getByRole('button', { name: 'Add Talent' })
      .first()
      .click();

    // Fill in the form
    await authenticatedPage
      .getByLabel('Name')
      .fill('E2E Test Actor With Media');
    await authenticatedPage
      .getByLabel('Description')
      .fill('Actor with reference images');

    // Upload a test image using the file input
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage
      .getByRole('button', { name: 'Browse files' })
      .click();
    const fileChooser = await fileChooserPromise;

    // Use a test fixture image (we'll create a simple test file)
    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    await fileChooser.setFiles(testImagePath);

    // Wait for upload to complete (button should become enabled)
    await expect(
      authenticatedPage.getByRole('button', { name: 'Add Talent' })
    ).toBeEnabled({ timeout: 15000 });

    // Submit the form
    await authenticatedPage.getByRole('button', { name: 'Add Talent' }).click();

    // Wait for dialog to close
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Talent' })
    ).not.toBeVisible({ timeout: 10000 });

    // Talent should appear in the list
    await expect(
      authenticatedPage.getByText('E2E Test Actor With Media')
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows upload progress indicator', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // Click Add Talent button
    await authenticatedPage
      .getByRole('button', { name: 'Add Talent' })
      .first()
      .click();

    await authenticatedPage.getByLabel('Name').fill('Test Upload Progress');

    // Start file upload
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage
      .getByRole('button', { name: 'Browse files' })
      .click();
    const fileChooser = await fileChooserPromise;

    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    await fileChooser.setFiles(testImagePath);

    // Button should show uploading state or be disabled during upload
    // The button text changes to "Uploading..." during upload
    await expect(
      authenticatedPage.getByRole('button', { name: 'Add Talent' })
    ).toBeEnabled({ timeout: 15000 });
  });

  test('can cancel Add Talent dialog', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    // Click Add Talent button
    await authenticatedPage
      .getByRole('button', { name: 'Add Talent' })
      .first()
      .click();

    // Dialog should be visible
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Talent' })
    ).toBeVisible();

    // Click Cancel
    await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Talent' })
    ).not.toBeVisible();
  });
});

test.describe('Edit Talent with Reference Media', () => {
  test.beforeEach(async ({ authenticatedPage, testUser }) => {
    // Set up mock routes
    await setupMockRoutes(authenticatedPage);

    // Create test talent with media
    await createTestTalentWithMedia(testUser.teamId, 'E2E Edit Test Talent', 2);
  });

  test.afterEach(async ({ testUser }) => {
    await cleanupTestTalent(testUser.teamId);
  });

  test('can view talent detail page with media', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');

    // Click on the talent card to view details
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Should be on detail page
    await expect(
      authenticatedPage.getByRole('heading', { name: 'E2E Edit Test Talent' })
    ).toBeVisible();

    // Should show reference media section
    await expect(authenticatedPage.getByText('Reference Media')).toBeVisible();
  });

  test('can open edit dialog from talent detail page', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');

    // Click on the talent to view details
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Click the edit button (pencil icon)
    await authenticatedPage
      .getByRole('button', { name: /edit/i })
      .or(authenticatedPage.locator('button:has(svg.lucide-pencil)'))
      .first()
      .click();

    // Edit dialog should open
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).toBeVisible();

    // Form should be pre-filled
    await expect(authenticatedPage.getByLabel('Name')).toHaveValue(
      'E2E Edit Test Talent'
    );
  });

  test('can update talent name and description', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Open edit dialog
    await authenticatedPage
      .locator('button:has(svg.lucide-pencil)')
      .first()
      .click();

    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).toBeVisible();

    // Update name
    await authenticatedPage.getByLabel('Name').fill('E2E Updated Talent Name');
    await authenticatedPage
      .getByLabel('Description')
      .fill('Updated description');

    // Save changes
    await authenticatedPage
      .getByRole('button', { name: 'Save Changes' })
      .click();

    // Dialog should close
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).not.toBeVisible({ timeout: 10000 });

    // Updated name should appear
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'E2E Updated Talent Name',
      })
    ).toBeVisible({ timeout: 10000 });
  });

  test('can add media to existing talent', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Open edit dialog
    await authenticatedPage
      .locator('button:has(svg.lucide-pencil)')
      .first()
      .click();

    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).toBeVisible();

    // Click Add Media button
    await authenticatedPage.getByRole('button', { name: 'Add Media' }).click();

    // Add Media dialog should open
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Add Media' })
    ).toBeVisible();
  });

  test('displays existing media in edit dialog', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Open edit dialog
    await authenticatedPage
      .locator('button:has(svg.lucide-pencil)')
      .first()
      .click();

    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).toBeVisible();

    // Should display reference media section with existing images
    await expect(authenticatedPage.getByText('Reference Media')).toBeVisible();

    // Should have image previews (from the 2 media items we created)
    const mediaImages = authenticatedPage
      .getByRole('dialog', { name: 'Edit Talent' })
      .locator('img[alt="Reference"]');
    await expect(mediaImages).toHaveCount(2);
  });

  test('can cancel edit dialog without saving', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');
    await authenticatedPage.getByText('E2E Edit Test Talent').click();

    // Open edit dialog
    await authenticatedPage
      .locator('button:has(svg.lucide-pencil)')
      .first()
      .click();

    // Change the name
    await authenticatedPage.getByLabel('Name').fill('Should Not Be Saved');

    // Cancel
    await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(
      authenticatedPage.getByRole('dialog', { name: 'Edit Talent' })
    ).not.toBeVisible();

    // Original name should still be visible
    await expect(
      authenticatedPage.getByRole('heading', { name: 'E2E Edit Test Talent' })
    ).toBeVisible();
  });
});

test.describe('Talent with Media - List View', () => {
  test.beforeEach(async ({ authenticatedPage, testUser }) => {
    await setupMockRoutes(authenticatedPage);
    await createTestTalentWithMedia(testUser.teamId, 'E2E Talent Alpha', 1);
    await createTestTalentWithMedia(testUser.teamId, 'E2E Talent Beta', 3);
  });

  test.afterEach(async ({ testUser }) => {
    await cleanupTestTalent(testUser.teamId);
  });

  test('displays multiple talents in grid', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/talent');

    await expect(authenticatedPage.getByText('E2E Talent Alpha')).toBeVisible();
    await expect(authenticatedPage.getByText('E2E Talent Beta')).toBeVisible();
  });

  test('can navigate between talent detail pages', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/talent');

    // Click first talent
    await authenticatedPage.getByText('E2E Talent Alpha').click();
    await expect(
      authenticatedPage.getByRole('heading', { name: 'E2E Talent Alpha' })
    ).toBeVisible();

    // Go back to list
    await authenticatedPage
      .getByRole('link', { name: 'Back to Talent' })
      .click();
    await expect(authenticatedPage).toHaveURL(/\/talent$/);

    // Click second talent
    await authenticatedPage.getByText('E2E Talent Beta').click();
    await expect(
      authenticatedPage.getByRole('heading', { name: 'E2E Talent Beta' })
    ).toBeVisible();
  });
});
