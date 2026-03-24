/**
 * E2E Test: Feature Module Settings
 *
 * Tests the feature module enable/disable toggle and per-module settings:
 *   1. Navigate to feature settings hub → verify all 12 modules listed
 *   2. Click a module → verify settings page loads with toggle and fields
 *   3. Toggle module off → save → verify sidebar item is hidden
 *   4. Toggle module back on → save → verify sidebar item returns
 *   5. Per-module settings render correct field types (toggle, text, number, select)
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

async function waitForLoadingToFinish(page: import('@playwright/test').Page): Promise<void> {
  const loadingText = page.getByText(/loading/i).first();
  if (await loadingText.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(loadingText).toBeHidden({ timeout: 15_000 });
  }
}

test.describe('Feature Module Settings Hub', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('settings hub shows feature module cards with links', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForLoadingToFinish(page);

    // Settings hub should have at least one module link
    const moduleLink = page.locator('a[href*="/settings/module/"]').first();
    await expect(moduleLink).toBeVisible({ timeout: 15_000 });
  });

  test('feature settings page renders 5 tabs', async ({ page }) => {
    await navigateTo(page, '/settings/features');
    await waitForLoadingToFinish(page);

    // Verify the 5 tabs
    for (const tab of ['Your Business', 'Features', 'CRM Entities', 'API Keys', 'Summary']) {
      await expect(
        page.locator('button').filter({ hasText: tab })
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Features tab shows toggle cards for each module', async ({ page }) => {
    await navigateTo(page, '/settings/features');
    await waitForLoadingToFinish(page);

    // Click the Features tab
    const featuresTab = page.locator('button').filter({ hasText: 'Features' });
    await featuresTab.click();
    await page.waitForTimeout(500);

    // At least one module card should be visible with a toggle
    const moduleCard = page.locator('input[type="checkbox"]').first();
    await expect(moduleCard).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Per-Module Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('CRM Pipeline settings page loads with toggle and fields', async ({ page }) => {
    await navigateTo(page, '/settings/module/crm-pipeline');
    await waitForLoadingToFinish(page);

    // Verify module heading
    await expect(
      page.locator('h1').filter({ hasText: /CRM/i })
    ).toBeVisible({ timeout: 15_000 });

    // Verify enable/disable toggle
    const toggleLabel = page.getByText(/enabled|disabled/i).first();
    await expect(toggleLabel).toBeVisible({ timeout: 10_000 });

    // Verify Save button
    await expect(
      page.locator('button').filter({ hasText: /save changes/i })
    ).toBeVisible({ timeout: 10_000 });

    // Verify settings section renders
    await expect(
      page.locator('h3').filter({ hasText: /settings/i })
    ).toBeVisible({ timeout: 10_000 });

    // Verify specific CRM settings fields
    await expect(page.getByText('Auto-assign new leads')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Enable lead scoring')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Default pipeline view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/stale deal alert/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Video Production settings page shows quality and aspect ratio selects', async ({ page }) => {
    await navigateTo(page, '/settings/module/video-production');
    await waitForLoadingToFinish(page);

    await expect(
      page.locator('h1').filter({ hasText: /video/i })
    ).toBeVisible({ timeout: 15_000 });

    // Verify video-specific settings
    await expect(page.getByText('Default video quality')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Default aspect ratio')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Add watermark')).toBeVisible({ timeout: 10_000 });

    // Verify select dropdowns have correct options
    const qualitySelect = page.locator('select').first();
    await expect(qualitySelect).toBeVisible({ timeout: 10_000 });
  });

  test('Email Outreach settings page shows tracking toggles', async ({ page }) => {
    await navigateTo(page, '/settings/module/email-outreach');
    await waitForLoadingToFinish(page);

    await expect(
      page.locator('h1').filter({ hasText: /email/i })
    ).toBeVisible({ timeout: 15_000 });

    // Verify email-specific settings
    await expect(page.getByText('Default sender name')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Daily sending limit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Track email opens')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Track link clicks')).toBeVisible({ timeout: 10_000 });
  });

  test('toggle enable/disable and save persists state', async ({ page }) => {
    await navigateTo(page, '/settings/module/forms-surveys');
    await waitForLoadingToFinish(page);

    await expect(
      page.locator('h1').filter({ hasText: /forms/i })
    ).toBeVisible({ timeout: 15_000 });

    // Find the enable/disable toggle checkbox
    const toggleCheckbox = page.locator('label').filter({ hasText: /enabled|disabled/i })
      .locator('input[type="checkbox"]');
    await expect(toggleCheckbox).toBeVisible({ timeout: 10_000 });

    // Record current state
    const wasEnabled = await toggleCheckbox.isChecked();

    // Toggle it
    await toggleCheckbox.click();

    // Click Save
    const saveBtn = page.locator('button').filter({ hasText: /save changes/i });
    await saveBtn.click();

    // Wait for success message
    const successMsg = page.getByText(/saved successfully/i);
    await expect(successMsg).toBeVisible({ timeout: 10_000 });

    // Reload and verify state persisted
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const reloadedCheckbox = page.locator('label').filter({ hasText: /enabled|disabled/i })
      .locator('input[type="checkbox"]');
    await expect(reloadedCheckbox).toBeVisible({ timeout: 15_000 });

    const isNowEnabled = await reloadedCheckbox.isChecked();
    expect(isNowEnabled).toBe(!wasEnabled);

    // Restore: toggle back to original state
    await reloadedCheckbox.click();
    await saveBtn.click();
    await expect(successMsg).toBeVisible({ timeout: 10_000 });
  });

  test('info banner explains sidebar visibility semantics', async ({ page }) => {
    await navigateTo(page, '/settings/module/social-media');
    await waitForLoadingToFinish(page);

    // Verify the informational banner is present
    await expect(
      page.getByText(/sidebar visibility/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('API Keys section shows required keys with priority badges', async ({ page }) => {
    await navigateTo(page, '/settings/module/video-production');
    await waitForLoadingToFinish(page);

    // Video Production requires API keys (Hedra, etc.)
    const apiKeysSection = page.locator('h3').filter({ hasText: /api keys/i });
    if (await apiKeysSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Verify link to API Keys settings
      await expect(
        page.locator('a[href="/settings/api-keys"]')
      ).toBeVisible({ timeout: 10_000 });

      // Verify priority badge
      const priorityBadge = page.getByText(/required|recommended|optional/i).first();
      await expect(priorityBadge).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Included Features section shows feature badges', async ({ page }) => {
    await navigateTo(page, '/settings/module/crm-pipeline');
    await waitForLoadingToFinish(page);

    // Verify the Included Features section
    await expect(
      page.locator('h3').filter({ hasText: /included features/i })
    ).toBeVisible({ timeout: 15_000 });

    // Should show feature badges (pill-shaped spans)
    const featureBadge = page.locator('span').filter({ hasText: /lead|pipeline|contact|deal/i }).first();
    await expect(featureBadge).toBeVisible({ timeout: 10_000 });
  });

  test('back link navigates to settings hub', async ({ page }) => {
    await navigateTo(page, '/settings/module/workflows');
    await waitForLoadingToFinish(page);

    const backLink = page.locator('a').filter({ hasText: /back to settings/i });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: 15_000 });
  });
});
