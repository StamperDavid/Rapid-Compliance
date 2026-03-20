/**
 * Forms & Workflows E2E Tests
 *
 * Covers the forms list page (card and table views, create modal)
 * and the workflows list page.
 *
 * All tests are read-only — no forms or workflows are created.
 * The create-modal test only verifies the modal opens and closes.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Auth setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});

// ---------------------------------------------------------------------------
// /forms
// ---------------------------------------------------------------------------

test.describe('Forms page', () => {
  test('loads with heading and Create New Form button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Forms' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Create New Form' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('filter tabs (All, Draft, Published, Archived) are rendered', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Four filter tab buttons are always rendered
    for (const label of ['All', 'Draft', 'Published', 'Archived']) {
      await expect(
        page.locator('button', { hasText: new RegExp(`^${label}`) })
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('view toggle (Cards / Table) is rendered', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // The view toggle group is rendered with aria-label
    const viewGroup = page.locator('[role="group"][aria-label="View options"]');
    await expect(viewGroup).toBeVisible({ timeout: 15_000 });

    await expect(
      viewGroup.locator('button', { hasText: 'Cards' })
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      viewGroup.locator('button', { hasText: 'Table' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('loading resolves — empty state or form cards appear in card view', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for skeleton loader to disappear (skeletons use animate-pulse)
    await page.waitForTimeout(2_000);

    const emptyState = page.locator('h3', { hasText: 'No forms yet' });
    // Card grid or DataTable (table view) will be visible when loaded
    const cardGrid = page.locator('.grid.grid-cols-1').first();
    const dataTable = page.locator('[placeholder="Search forms..."]');
    await expect(emptyState.or(cardGrid).or(dataTable)).toBeVisible({ timeout: 15_000 });
  });

  test('table view renders when Table button is clicked', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const viewGroup = page.locator('[role="group"][aria-label="View options"]');
    const tableBtn = viewGroup.locator('button', { hasText: 'Table' });
    await tableBtn.click();

    // After switching to table view, the DataTable search input becomes visible
    // (or the "Loading forms..." placeholder when data is being fetched)
    const searchInput = page.locator('[placeholder="Search forms..."]');
    const loadingPlaceholder = page.locator('text=Loading forms...');
    await expect(searchInput.or(loadingPlaceholder)).toBeVisible({ timeout: 15_000 });
  });

  test('Create New Form modal opens with form name input and template picker', async ({ page }) => {
    await page.goto(`${BASE_URL  }/forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Open the modal
    await page.locator('button', { hasText: 'Create New Form' }).click();

    // Modal heading
    await expect(
      page.locator('h2', { hasText: 'Create New Form' })
    ).toBeVisible({ timeout: 15_000 });

    // Form name input field
    await expect(
      page.locator('input[placeholder="Enter form name..."]')
    ).toBeVisible({ timeout: 10_000 });

    // Template picker shows "Blank Form" option
    await expect(
      page.locator('text=Blank Form')
    ).toBeVisible({ timeout: 10_000 });

    // Cancel closes the modal without doing anything
    await page.locator('button', { hasText: 'Cancel' }).click();

    await expect(
      page.locator('h2', { hasText: 'Create New Form' })
    ).toBeHidden({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// /workflows
// ---------------------------------------------------------------------------

test.describe('Workflows page', () => {
  test('loads with heading and Create Workflow button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/workflows`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Workflows' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Create Workflow' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('sub-heading "Automate your sales processes" is visible', async ({ page }) => {
    await page.goto(`${BASE_URL  }/workflows`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Automate your sales processes')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or workflow cards appear', async ({ page }) => {
    await page.goto(`${BASE_URL  }/workflows`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('h3', { hasText: 'No workflows yet' });
    // Workflow cards appear inside a motion.div with class grid
    const workflowGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(workflowGrid)).toBeVisible({ timeout: 15_000 });
  });
});
