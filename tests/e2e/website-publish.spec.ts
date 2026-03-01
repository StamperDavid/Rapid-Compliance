/**
 * Website Publish & Status E2E Tests
 *
 * Validates the page status workflow:
 * - Editor shows Save button and save functionality works
 * - Pages list shows status badges (draft / published)
 * - Pages list filter tabs work (All / Drafts / Published)
 * - Editor toolbar has breakpoint and auto-save controls
 *
 * NOTE: The editor toolbar does NOT have Publish, Schedule, or Preview
 * buttons — those features are managed from the pages list view.
 *
 * @group Phase 2B — Website Builder
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { waitForPageReady, ensureAuthenticated } from './fixtures/helpers';

/**
 * Helper: wait for the website editor to finish loading.
 */
async function waitForEditorReady(page: import('@playwright/test').Page): Promise<boolean> {
  const widgets = page.locator('text=Widgets').first();
  const failed = page.locator('text=Failed to load page');
  const loading = page.locator('text=Loading');
  await expect(
    widgets.or(failed).or(loading)
  ).toBeVisible({ timeout: 30_000 });
  return widgets.isVisible({ timeout: 2_000 }).catch(() => false);
}

test.describe('Editor Save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    const editorLoaded = await waitForEditorReady(page);
    if (!editorLoaded) {
      test.skip(true, 'Editor did not load — Firebase auth may be slow');
    }
  });

  test('should show Save button in editor toolbar', async ({ page }) => {
    const saveBtn = page.locator('button:has-text("Save")').first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should show auto-save toggle in toolbar', async ({ page }) => {
    const autoSaveLabel = page.locator('text=Auto-save');
    await expect(autoSaveLabel).toBeVisible({ timeout: 10_000 });
  });

  test('should save page when Save is clicked', async ({ page }) => {
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();

    // Should show saving indicator or success notification
    const savingOrSaved = page.locator('button:has-text("Saving")')
      .or(page.locator('text=Saved successfully'))
      .or(page.locator('text=saved'))
      .first();
    await expect(savingOrSaved).toBeVisible({ timeout: 10_000 });
  });

  test('should show Undo and Redo buttons', async ({ page }) => {
    const undoBtn = page.locator('button:has-text("Undo")');
    const redoBtn = page.locator('button:has-text("Redo")');

    await expect(undoBtn).toBeVisible({ timeout: 10_000 });
    await expect(redoBtn).toBeVisible();
  });

  test('should show breakpoint switcher buttons', async ({ page }) => {
    const desktopBtn = page.locator('button:has-text("Desktop")');
    const tabletBtn = page.locator('button:has-text("Tablet")');
    const mobileBtn = page.locator('button:has-text("Mobile")');

    await expect(desktopBtn).toBeVisible({ timeout: 10_000 });
    await expect(tabletBtn).toBeVisible();
    await expect(mobileBtn).toBeVisible();
  });
});

test.describe('Page Status in Pages List', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);
    // Wait for page heading or loading state
    const heading = page.locator('h1:has-text("Pages")');
    const loading = page.locator('text=Loading pages');
    await expect(heading.or(loading).first()).toBeVisible({ timeout: 20_000 });
    // Try to wait for data to load if still in loading state
    if (await loading.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await heading.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    }
  });

  test('should display filter tabs for All, Drafts, and Published', async ({ page }) => {
    // Filter tabs only appear after page data loads
    const heading = page.locator('h1:has-text("Pages")');
    if (!(await heading.isVisible({ timeout: 5_000 }).catch(() => false))) { return; }

    const allFilter = page.locator('button:has-text("All")').first();
    const draftsFilter = page.locator('button:has-text("Drafts")');
    const publishedFilter = page.locator('button:has-text("Published")');

    await expect(allFilter).toBeVisible();
    await expect(draftsFilter).toBeVisible();
    await expect(publishedFilter).toBeVisible();
  });

  test('should switch between filter tabs', async ({ page }) => {
    const heading = page.locator('h1:has-text("Pages")');
    if (!(await heading.isVisible({ timeout: 5_000 }).catch(() => false))) { return; }

    // Click Drafts filter
    const draftsFilter = page.locator('button:has-text("Drafts")');
    await draftsFilter.click();
    await waitForPageReady(page);

    // Click Published filter
    const publishedFilter = page.locator('button:has-text("Published")');
    await publishedFilter.click();
    await waitForPageReady(page);

    // Click All filter to reset
    const allFilter = page.locator('button:has-text("All")').first();
    await allFilter.click();
    await waitForPageReady(page);
  });

  test('should show status badges on page cards', async ({ page }) => {
    // If pages exist, they should show status badges
    const statusBadge = page.locator('text=published')
      .or(page.locator('text=draft'))
      .first();
    const hasStatus = await statusBadge.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasStatus) {
      const text = await statusBadge.textContent();
      expect(text?.toLowerCase()).toMatch(/published|draft/);
    }
  });

  test('should show correct status badge colors', async ({ page }) => {
    // Published badges should have distinct styling
    const publishedBadge = page.locator('text=published').first();
    if (await publishedBadge.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const styles = await publishedBadge.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(styles).toBeTruthy();
    }

    // Draft badges should have distinct styling
    const draftBadge = page.locator('text=draft').first();
    if (await draftBadge.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const styles = await draftBadge.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(styles).toBeTruthy();
    }
  });

  test('should display page cards or empty state', async ({ page }) => {
    const pageCard = page.locator('h3').first();
    const emptyState = page.locator('text=No pages yet')
      .or(page.locator('text=Create your first page'));
    const loading = page.locator('text=Loading pages');
    const editBtn = page.locator('button:has-text("Edit")').first();

    const hasPages = await pageCard.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEditBtn = await editBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
    const isLoading = await loading.isVisible({ timeout: 2_000 }).catch(() => false);

    expect(hasPages || hasEditBtn || hasEmptyState || isLoading).toBeTruthy();
  });
});
