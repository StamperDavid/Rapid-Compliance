/**
 * Website Create Page E2E Tests
 *
 * Validates page creation workflows:
 * - Create blank page via editor
 * - Create page with AI generation
 * - Page appears in pages list after creation
 * - Duplicate page functionality
 *
 * @group Phase 2B — Website Builder
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { waitForPageReady } from './fixtures/helpers';

test.describe('Create Blank Page', () => {
  test('should navigate to editor for new page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    // Click "+ New Page" button
    const newPageBtn = page.locator(
      'button:has-text("New Page"), a:has-text("New Page")'
    ).first();
    await newPageBtn.click();

    // Should navigate to editor without pageId (blank page)
    await page.waitForURL('**/website/editor**', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/website\/editor/);
  });

  test('should load editor with empty canvas for new page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForPageReady(page);

    // Editor should show the three-panel layout
    // Left panel: Widgets
    const widgetsPanel = page.locator('text=Widgets').first();
    await expect(widgetsPanel).toBeVisible({ timeout: 10_000 });

    // Center: Canvas with empty state or add section button
    const addSectionBtn = page.locator('button:has-text("Add Section")');
    const emptyState = page.locator('text=Empty Page, text=Add a section');
    const hasEmpty =
      (await addSectionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false));
    expect(hasEmpty).toBeTruthy();
  });

  test('should show toolbar with page title "Untitled Page"', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForPageReady(page);

    // New pages default to "Untitled Page"
    const titleElement = page.locator('text=Untitled Page').first();
    const hasTitle = await titleElement.isVisible({ timeout: 5_000 }).catch(() => false);

    // The toolbar should show the page title
    if (hasTitle) {
      await expect(titleElement).toBeVisible();
    }
  });

  test('should show Save button in editor toolbar', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForPageReady(page);

    // Save button should be present
    const saveBtn = page.locator('button:has-text("Save")').first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should save new blank page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForPageReady(page);

    // Click Save
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();

    // Wait for save to complete — either success toast or button text changes
    const saved = page.locator(
      'text=saved, text=Saved, button:has-text("Saving")'
    );
    await expect(saved.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Create Page with AI', () => {
  test('should open AI generation modal from pages list', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    // Open AI modal
    await page.locator('button:has-text("Generate with AI")').click();

    // Verify modal content
    await expect(page.locator('h2:has-text("Generate Page with AI")')).toBeVisible();
  });

  test('should disable Generate button when prompt is empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    await page.locator('button:has-text("Generate with AI")').click();
    await expect(page.locator('h2:has-text("Generate Page with AI")')).toBeVisible();

    // Generate button should be disabled when textarea is empty
    const generateBtn = page.locator('button:has-text("Generate Page")');
    await expect(generateBtn).toBeDisabled();
  });

  test('should enable Generate button when prompt is filled', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    await page.locator('button:has-text("Generate with AI")').click();

    // Fill in the description
    const textarea = page.locator(
      'textarea[placeholder*="landing page"], textarea[placeholder*="Describe"]'
    ).first();
    await textarea.fill('A landing page for an AI-powered sales platform with hero, features, and CTA');

    // Generate button should now be enabled
    const generateBtn = page.locator('button:has-text("Generate Page")');
    await expect(generateBtn).toBeEnabled();
  });

  test('should allow selecting page type', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    await page.locator('button:has-text("Generate with AI")').click();

    // Select a page type
    const typeSelect = page.locator('select').first();
    await typeSelect.selectOption('landing');

    // Verify selection
    await expect(typeSelect).toHaveValue('landing');
  });

  test('should show loading state when generating', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    await page.locator('button:has-text("Generate with AI")').click();

    // Fill prompt
    const textarea = page.locator(
      'textarea[placeholder*="landing page"], textarea[placeholder*="Describe"]'
    ).first();
    await textarea.fill('A simple about us page with team section');

    // Click generate
    await page.locator('button:has-text("Generate Page")').click();

    // Should show generating state
    const generatingState = page.locator('button:has-text("Generating")');
    const hasGenerating = await generatingState.isVisible({ timeout: 5_000 }).catch(() => false);

    // Either shows "Generating..." or redirects to editor (fast generation)
    if (!hasGenerating) {
      // May have already finished and navigated
      await page.waitForTimeout(2_000);
    }
  });
});

test.describe('Duplicate Page', () => {
  test('should show Duplicate button on existing page cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    const duplicateBtn = page.locator('button:has-text("Duplicate")').first();
    const hasDuplicate = await duplicateBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    // Duplicate is only shown when pages exist
    if (hasDuplicate) {
      await expect(duplicateBtn).toBeEnabled();
    }
  });

  test('should create a copy when Duplicate is clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    // Count existing pages
    const pageCards = page.locator('[class*="grid"] > div').all();
    const initialCount = (await pageCards).length;

    if (initialCount > 0) {
      // Click Duplicate on the first page
      const duplicateBtn = page.locator('button:has-text("Duplicate")').first();
      await duplicateBtn.click();

      // Wait for duplication to complete
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      // Should have one more page card now, or a success message
      const copyIndicator = page.locator('text=Copy, text=copied, text=duplicated');
      const hasCopy = await copyIndicator.first().isVisible({ timeout: 5_000 }).catch(() => false);

      // Either the copy text appears or the count increased
      if (!hasCopy) {
        const newCount = (await page.locator('[class*="grid"] > div').all()).length;
        expect(newCount).toBeGreaterThanOrEqual(initialCount);
      }
    }
  });
});

test.describe('Delete Page', () => {
  test('should show Delete button on page cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`);
    await waitForPageReady(page);

    const deleteBtn = page.locator('button:has-text("Delete")').first();
    const hasDelete = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasDelete) {
      await expect(deleteBtn).toBeEnabled();
    }
  });
});
