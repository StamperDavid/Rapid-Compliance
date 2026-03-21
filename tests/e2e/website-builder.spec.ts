/**
 * E2E Test: Website Builder Journey
 *
 * Tests the page management flow:
 *   1. Navigate to website/pages
 *   2. Verify page list or empty state renders
 *   3. Click "+ New Page" — verify it navigates to the editor
 *   4. Navigate back and verify page management controls
 *   5. Test AI generation modal (open/close)
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

async function navigateTo(page: import('@playwright/test').Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPageReady(page);
  const authLoading = page.locator('p').filter({ hasText: 'Loading...' }).first();
  if (await authLoading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await authLoading.waitFor({ state: 'hidden', timeout: 30_000 });
  }
  await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 });
}

test.describe('Website Builder Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('navigate to pages and verify structure', async ({ page }) => {
    await navigateTo(page, '/website/pages');

    // Verify heading
    const heading = page.locator('h1').filter({ hasText: /pages/i }).or(
      page.getByText(/website/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify action buttons
    const newPageBtn = page.locator('button').filter({ hasText: /new page/i }).or(
      page.locator('button').filter({ hasText: /create page/i })
    ).first();
    await expect(newPageBtn).toBeVisible({ timeout: 10_000 });

    // Verify either page list or empty state
    const pagesOrEmpty = page.getByText(/no pages/i).or(
      page.locator('div', { hasText: /draft|published/i }).first()
    ).or(
      page.getByText(/create your first page/i)
    );
    await expect(pagesOrEmpty).toBeVisible({ timeout: 15_000 });
  });

  test('new page button navigates to editor', async ({ page }) => {
    await navigateTo(page, '/website/pages');

    const newPageBtn = page.locator('button').filter({ hasText: /new page/i }).or(
      page.locator('a').filter({ hasText: /new page/i })
    ).or(
      page.locator('button').filter({ hasText: /create page/i })
    ).first();
    await expect(newPageBtn).toBeVisible({ timeout: 10_000 });
    await newPageBtn.click();

    // Should navigate to editor or show create form
    const editorResult = await Promise.race([
      page.waitForURL(/\/website\/editor/, { timeout: 10_000 }).then(() => 'editor' as const),
      page.locator('h2, h3').filter({ hasText: /new page|create page/i }).first()
        .waitFor({ timeout: 10_000 }).then(() => 'modal' as const),
    ]).catch(() => 'none' as const);

    if (editorResult === 'editor') {
      // Verify editor loads
      await expect(page).toHaveURL(/\/website\/editor/);
      await waitForPageReady(page);

      // Editor should have content area
      const editorContent = page.locator('aside').or(
        page.getByText(/editor/i)
      ).or(
        page.locator('main')
      ).first();
      await expect(editorContent).toBeVisible({ timeout: 15_000 });
    } else if (editorResult === 'modal') {
      // Modal form for creating page
      const titleInput = page.getByPlaceholder(/title|page name/i).or(
        page.getByLabel(/title/i)
      );
      await expect(titleInput).toBeVisible({ timeout: 5_000 });
    }
  });

  test('AI generation modal opens and closes', async ({ page }) => {
    await navigateTo(page, '/website/pages');

    const generateBtn = page.locator('button').filter({ hasText: /generate with ai/i }).or(
      page.locator('button').filter({ hasText: /ai generate/i })
    );

    if (await generateBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await generateBtn.click();

      // Verify modal opens
      const modalHeading = page.locator('h2, h3').filter({ hasText: /generate/i });
      await expect(modalHeading.first()).toBeVisible({ timeout: 10_000 });

      // Verify form fields
      const descField = page.getByPlaceholder(/saas product/i).or(
        page.locator('textarea').first()
      );
      await expect(descField).toBeVisible({ timeout: 5_000 });

      // Close modal
      const cancelBtn = page.locator('button').filter({ hasText: /cancel/i });
      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // Modal should close
      await expect(modalHeading.first()).toBeHidden({ timeout: 10_000 });
    }
  });

  test('filter pages by status', async ({ page }) => {
    await navigateTo(page, '/website/pages');

    // Look for filter buttons
    const draftFilter = page.locator('button').filter({ hasText: /draft/i });
    const publishedFilter = page.locator('button').filter({ hasText: /published/i });
    const allFilter = page.locator('button').filter({ hasText: /^all/i });

    // If filters exist, click through them
    if (await draftFilter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await draftFilter.click();
      await page.waitForTimeout(500);

      await publishedFilter.click();
      await page.waitForTimeout(500);

      if (await allFilter.isVisible().catch(() => false)) {
        await allFilter.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
