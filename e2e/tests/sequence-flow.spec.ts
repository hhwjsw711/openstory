/**
 * Sequence Creation Flow E2E Tests
 *
 * Tests the complete flow:
 * 1. Create sequence with suggested talent
 * 2. Generate and select variants
 * 3. Recast character with different talent
 */

import { expect } from 'playwright/test';
import { test as testWithUser } from '../fixtures/auth.fixture';
import { setupMockRoutes } from '../mocks/handlers';
import {
  createTestTalentSet,
  cleanupTalentById,
  type TestTalent,
} from '../fixtures/talent.fixture';
import {
  createTestSequence,
  createTestFrame,
  createTestCharacter,
  cleanupSequenceById,
  getTestFrame,
  getTestCharacter,
  type TestSequence,
  type TestFrame,
  type TestCharacter,
} from '../fixtures/sequence.fixture';

// Run serially because tests share data created in beforeEach
testWithUser.describe('Sequence Creation Flow', () => {
  testWithUser.describe.configure({ mode: 'serial' });
  let testTalents: TestTalent[] = [];

  testWithUser.beforeEach(async ({ page, testUser }) => {
    // Setup mock routes for AI/workflow calls
    await setupMockRoutes(page);

    // Create test talent for the test user's team
    testTalents = await createTestTalentSet(testUser.teamId, [
      'E2E Test Actor One',
      'E2E Test Actor Two',
    ]);
  });

  testWithUser.afterEach(async () => {
    // Cleanup test data - only the specific talents we created
    for (const t of testTalents) {
      await cleanupTalentById(t.id);
    }
    testTalents = [];
  });

  testWithUser(
    'can create sequence with suggested talent',
    async ({ page }) => {
      // Navigate to new sequence page
      await page.goto('/sequences/new');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/sequences/new');

      // Verify script textarea is visible
      const scriptTextarea = page.locator('textarea');
      await expect(scriptTextarea).toBeVisible();

      // Enter a simple test script
      const testScript = `
INT. COFFEE SHOP - DAY

JOHN, a 30-something developer, sits at a table with his laptop.

JOHN
I need to fix this bug before the demo.

SARAH, his colleague, approaches with two coffees.

SARAH
Here's your caffeine fix. How's it going?
    `.trim();

      await scriptTextarea.fill(testScript);

      // Wait for textarea to have content
      await expect(scriptTextarea).toHaveValue(testScript);

      // Open talent suggestion dialog - find the button with Users icon in the main area
      // The button has an icon and "Talent" text
      const talentButton = page
        .locator('main')
        .getByRole('button', { name: 'Talent' });
      await expect(talentButton).toBeVisible();
      await talentButton.click();

      // Wait for talent dialog to open - the dialog is rendered via a portal
      // Use a longer timeout as it may need to fetch talent data
      const talentDialog = page.getByRole('dialog');
      await expect(talentDialog).toBeVisible({ timeout: 10000 });
      await expect(
        talentDialog.getByText('Select Talent for Casting')
      ).toBeVisible();

      // Verify our test talents appear in the dialog
      await expect(page.getByText('E2E Test Actor One')).toBeVisible();
      await expect(page.getByText('E2E Test Actor Two')).toBeVisible();

      // Select first talent by clicking on it
      await page.getByText('E2E Test Actor One').click();

      // Close dialog
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(talentDialog).not.toBeVisible();

      // Verify submit button is ready (may have different text based on state)
      const submitButton = page.getByRole('button', { name: /Activate/i });
      await expect(submitButton).toBeVisible();
    }
  );
});

// Run serially because tests share data created in beforeEach
testWithUser.describe('Variant Selection', () => {
  testWithUser.describe.configure({ mode: 'serial' });
  let testSequence: TestSequence;
  let testFrame: TestFrame;
  const originalThumbnailUrl = 'https://picsum.photos/seed/e2e-thumb/1024/576';

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);

    // Create pre-seeded sequence with frame that has variant image
    testSequence = await createTestSequence(
      testUser.teamId,
      testUser.id,
      'E2E Variant Test Sequence'
    );
    testFrame = await createTestFrame(testSequence.id, 0, {
      // Use real placeholder images
      thumbnailUrl: originalThumbnailUrl,
      variantImageUrl: 'https://picsum.photos/seed/e2e-variants/3072/3072',
      variantImageStatus: 'completed',
    });
  });

  testWithUser.afterEach(async () => {
    await cleanupSequenceById(testSequence.id, testSequence.styleId);
  });

  testWithUser('can select variant from grid', async ({ page }) => {
    // Verify initial state in database
    const frameBefore = await getTestFrame(testFrame.id);
    expect(frameBefore?.thumbnailUrl).toBe(originalThumbnailUrl);

    // Navigate directly to the sequence scenes page
    await page.goto(`/sequences/${testSequence.id}/scenes`);

    // Don't use networkidle - the page has a realtime SSE connection that never settles
    // Wait for the sequence title to be visible (indicates data has loaded and React is hydrated)
    await expect(
      page.getByRole('heading', { name: 'E2E Variant Test Sequence' })
    ).toBeVisible({ timeout: 15000 });

    // Also wait for the frame thumbnail to be visible
    await expect(page.getByRole('img', { name: 'Scene 1' })).toBeVisible();

    const variantsTab = page.getByRole('tab', { name: /Variants/i });
    await expect(variantsTab).toBeVisible();

    // Click the Variants tab
    await variantsTab.click();

    const variantGrid = page.getByRole('grid', { name: 'Variant selection' });

    // Wait for variant grid to be visible
    await expect(variantGrid).toBeVisible({ timeout: 10000 });

    // Click on variant 5 (center tile)
    const variant5 = page.getByRole('button', { name: 'Select variant 5' });
    await expect(variant5).toBeVisible();
    await variant5.click();

    // Confirmation dialog should appear
    await expect(page.getByText('Select this variant?')).toBeVisible();

    // Confirm selection
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Dialog should close
    await expect(page.getByText('Select this variant?')).not.toBeVisible();

    // Wait for the API call to complete and verify database was updated
    // The thumbnailUrl should have changed from the original
    await expect
      .poll(
        async () => {
          const frameAfter = await getTestFrame(testFrame.id);
          return frameAfter?.thumbnailUrl;
        },
        { timeout: 10000 }
      )
      .not.toBe(originalThumbnailUrl);
  });
});

// Run serially because tests share data created in beforeEach
testWithUser.describe('Character Recast', () => {
  testWithUser.describe.configure({ mode: 'serial' });
  let testTalents: TestTalent[] = [];
  let testSequence: TestSequence;
  let testCharacter: TestCharacter;

  testWithUser.beforeEach(async ({ page, testUser }) => {
    await setupMockRoutes(page);

    // Create test talent
    testTalents = await createTestTalentSet(testUser.teamId, [
      'E2E Current Actor',
      'E2E New Actor',
    ]);

    // Create pre-seeded sequence with character
    testSequence = await createTestSequence(
      testUser.teamId,
      testUser.id,
      'E2E Recast Test Sequence'
    );

    // Create a character linked to the first talent
    testCharacter = await createTestCharacter(
      testSequence.id,
      'char_001',
      'John',
      testTalents[0].id,
      {
        // Use real placeholder image
        sheetImageUrl: 'https://picsum.photos/seed/e2e-character/1920/1080',
        sheetStatus: 'completed',
      }
    );
  });

  testWithUser.afterEach(async () => {
    // Cleanup specific entities we created
    for (const t of testTalents) {
      await cleanupTalentById(t.id);
    }
    await cleanupSequenceById(testSequence.id, testSequence.styleId);
    testTalents = [];
  });

  testWithUser(
    'can recast character with different talent',
    async ({ page }) => {
      // Verify initial state - character is linked to first talent
      const characterBefore = await getTestCharacter(testCharacter.id);
      expect(characterBefore?.talentId).toBe(testTalents[0].id);

      // Navigate to the character detail page
      await page.goto(`/sequences/${testSequence.id}/cast/${testCharacter.id}`);

      // Wait for character detail to load
      await expect(page.getByText('John')).toBeVisible({ timeout: 10000 });

      // Click Recast button
      const recastButton = page.getByRole('button', { name: 'Recast' });
      await expect(recastButton).toBeVisible();
      await recastButton.click();

      // Talent picker dialog should open
      const talentDialog = page.getByRole('dialog');
      await expect(talentDialog).toBeVisible();
      await expect(talentDialog.getByText('Select Talent')).toBeVisible();

      // Select the second talent (E2E New Actor)
      await page.getByText('E2E New Actor').click();

      // Recast confirmation dialog should appear
      await expect(
        page.getByText(/Recast E2E New Actor as John/i)
      ).toBeVisible();

      // Confirm the recast
      await page.getByRole('button', { name: 'Recast' }).click();

      // The confirmation dialog should close (loading state may briefly appear)
      // With mocks, the mutation should complete quickly
      await expect(
        page.getByText(/Recast E2E New Actor as John/i)
      ).not.toBeVisible({ timeout: 10000 });

      // Verify the database was updated - character now linked to second talent
      await expect
        .poll(
          async () => {
            const characterAfter = await getTestCharacter(testCharacter.id);
            return characterAfter?.talentId;
          },
          { timeout: 10000 }
        )
        .toBe(testTalents[1].id);
    }
  );
});

// Skip empty state test in parallel mode - it interferes with other tests
// by cleaning up all talent for the shared team. This test works in serial mode.
// TODO: Consider running this test with a dedicated user/team for isolation
testWithUser.describe.skip('Empty States', () => {
  testWithUser(
    'shows empty state when no talent in library',
    async ({ page }) => {
      await setupMockRoutes(page);

      await page.goto('/sequences/new');
      await page.waitForLoadState('networkidle');

      // Wait for the page to load
      await page.locator('textarea').waitFor();

      // Open talent dialog - find button in main content area
      const talentButton = page
        .locator('main')
        .getByRole('button', { name: 'Talent' });
      await expect(talentButton).toBeVisible();
      await talentButton.click();

      // Wait for dialog to open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Verify empty state
      await expect(page.getByText('No talent in library')).toBeVisible();
    }
  );
});
