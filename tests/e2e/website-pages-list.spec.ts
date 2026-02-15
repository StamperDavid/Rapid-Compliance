/**
 * Website Pages List E2E Tests
 *
 * Validates the website pages management view:
 * - Page list loads and displays pages
 * - Filter tabs work (All / Drafts / Published)
 * - Page cards show correct information
 * - Action buttons (Edit, Duplicate, Delete) function
 *
 * @group Phase 2B — Website Builder
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { waitForPageReady, ensureAuthenticated } from './fixtures/helpers';

/**
 * Helper: wait for the pages list to finish loading.
 * Waits for a positive indicator (page heading visible) rather than
 * just checking for "Loading pages..." disappearance.
 */
async function waitForPagesReady(page: import('@playwright/test').Page): Promise<void> {
  await waitForPageReady(page);
  // Wait for either the page heading to appear or the loading to finish
  await expect(
    page.locator('h1, h2').filter({ hasText: /pages/i }).first()
      .or(page.locator('text=No pages yet'))
      .or(page.locator('button:has-text("New Page")'))
  ).toBeVisible({ timeout: 20_000 });
}

test.describe('Website Pages List', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPagesReady(page);
  });

  test('should load pages list with header and action buttons', async ({ page }) => {
    // Verify page header
    const heading = page.locator('h1, h2').filter({ hasText: /pages/i }).first();
    await expect(heading).toBeVisible();

    // Verify "New Page" button exists
    const newPageBtn = page.locator('button:has-text("New Page"), a:has-text("New Page")');
    await expect(newPageBtn).toBeVisible();

    // Verify "Generate with AI" button exists
    const aiBtn = page.locator('button:has-text("Generate with AI")');
    await expect(aiBtn).toBeVisible();
  });

  test('should display filter tabs for All, Drafts, and Published', async ({ page }) => {
    // Filter buttons should be present
    const allFilter = page.locator('button:has-text("All")').first();
    const draftsFilter = page.locator('button:has-text("Drafts")');
    const publishedFilter = page.locator('button:has-text("Published")');

    await expect(allFilter).toBeVisible();
    await expect(draftsFilter).toBeVisible();
    await expect(publishedFilter).toBeVisible();
  });

  test('should switch between filter tabs', async ({ page }) => {
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

  test('should display page cards or empty state', async ({ page }) => {
    // Either page cards are shown or the empty state message
    const pageCards = page.locator('[class*="grid"] > div, [class*="card"]');
    const emptyState = page.locator('text=No pages yet, text=Create your first page');

    const hasPages = await pageCards.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);

    // One of these must be true
    expect(hasPages || hasEmptyState).toBeTruthy();
  });

  test('should show status badges on page cards', async ({ page }) => {
    // If pages exist, they should show status badges
    const statusBadge = page.locator('text=published, text=draft').first();
    const hasStatus = await statusBadge.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasStatus) {
      // Status badge should contain either "published" or "draft"
      const text = await statusBadge.textContent();
      expect(text?.toLowerCase()).toMatch(/published|draft/);
    }
  });

  test('should have Edit action on page cards', async ({ page }) => {
    // If pages exist, look for Edit buttons
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    const hasEdit = await editBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasEdit) {
      await expect(editBtn).toBeEnabled();
    }
  });

  test('should navigate to editor when clicking New Page', async ({ page }) => {
    const newPageBtn = page.locator(
      'button:has-text("New Page"), a:has-text("New Page")'
    ).first();
    await newPageBtn.click();

    // Should navigate to the editor
    await page.waitForURL('**/website/editor**', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/website\/editor/);
  });

  test('should open AI generation modal', async ({ page }) => {
    const aiBtn = page.locator('button:has-text("Generate with AI")');
    await aiBtn.click();

    // Modal should appear with AI generation form
    const modal = page.locator('h2:has-text("Generate Page with AI")');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal should have description textarea
    const textarea = page.locator(
      'textarea[placeholder*="landing page"], textarea[placeholder*="Describe"]'
    );
    await expect(textarea).toBeVisible();

    // Modal should have page type selector
    const typeSelect = page.locator('select:has-text("Auto-detect")');
    await expect(typeSelect).toBeVisible();

    // Modal should have Generate and Cancel buttons
    await expect(page.locator('button:has-text("Generate Page")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('should close AI modal on Cancel', async ({ page }) => {
    // Open modal
    await page.locator('button:has-text("Generate with AI")').click();
    await expect(page.locator('h2:has-text("Generate Page with AI")')).toBeVisible();

    // Click cancel
    await page.locator('button:has-text("Cancel")').click();

    // Modal should close
    await expect(page.locator('h2:has-text("Generate Page with AI")')).toBeHidden();
  });

  test('should show page slugs on cards', async ({ page }) => {
    // If pages exist, their slug paths should be displayed
    const slugDisplay = page.locator('text=/^\\/[a-z0-9-]+/').first();
    const hasSlugs = await slugDisplay.isVisible({ timeout: 5_000 }).catch(() => false);

    // Slugs are only shown when pages exist — this is a conditional check
    if (hasSlugs) {
      const text = await slugDisplay.textContent();
      expect(text).toMatch(/^\/[a-z0-9-]/);
    }
  });
});

test.describe('Website Pages List — Responsive', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    await ensureAuthenticated(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPagesReady(page);

    // Page should still show header and action buttons
    const heading = page.locator('h1, h2').filter({ hasText: /pages/i }).first();
    await expect(heading).toBeVisible();
  });
});
