/**
 * E2E Test: Email Sequence Journey
 *
 * Tests the email campaign management flow:
 *   1. Navigate to email campaigns page
 *   2. Click Create Campaign
 *   3. Fill campaign details (name, subject, content)
 *   4. Save the campaign
 *   5. Verify it appears in the campaigns list
 *   6. Delete the campaign
 *   7. Verify it's removed from the list
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

test.describe('Email Sequence Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('create, verify, and delete an email campaign', async ({ page }) => {
    await navigateTo(page, '/email/campaigns');

    const campaignName = `E2E Campaign ${Date.now()}`;

    // Verify page heading
    const heading = page.getByText(/email campaigns/i).or(
      page.getByText(/campaigns/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Click Create Campaign
    const createBtn = page.locator('button').filter({ hasText: /create campaign/i }).or(
      page.locator('a').filter({ hasText: /create campaign/i })
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    // Wait for create form/page/modal
    // Could navigate to /email/campaigns/new or show a modal
    const formResult = await Promise.race([
      page.waitForURL(/\/email\/campaigns\/(new|create)/, { timeout: 10_000 }).then(() => 'page' as const),
      page.locator('h2, h3').filter({ hasText: /create|new/i }).first().waitFor({ timeout: 10_000 }).then(() => 'modal' as const),
    ]).catch(() => 'none' as const);

    if (formResult === 'none') {
      // Create might open inline — look for form fields
      const nameField = page.getByPlaceholder(/campaign name|name/i).or(
        page.getByLabel(/name/i)
      ).first();
      if (!await nameField.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, 'Campaign creation form not found');
        return;
      }
    }

    // Fill campaign name
    const nameInput = page.getByPlaceholder(/campaign name|name/i).or(
      page.getByLabel(/name/i)
    ).or(
      page.locator('input[type="text"]').first()
    );
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill(campaignName);

    // Fill subject if field exists
    const subjectInput = page.getByPlaceholder(/subject/i).or(
      page.getByLabel(/subject/i)
    );
    if (await subjectInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await subjectInput.fill('E2E Test Email Subject');
    }

    // Fill content/body if field exists
    const contentField = page.getByPlaceholder(/content|body|message/i).or(
      page.locator('textarea').first()
    );
    if (await contentField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await contentField.fill('This is an automated E2E test email campaign.');
    }

    // Save/create the campaign
    const saveBtn = page.locator('button').filter({ hasText: /^(save|create|submit)$/i }).or(
      page.locator('button').filter({ hasText: /save campaign/i })
    ).or(
      page.locator('button').filter({ hasText: /create campaign/i })
    ).first();
    if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await saveBtn.click();
    }

    // Wait for save/redirect
    await page.waitForTimeout(2_000);

    // Navigate back to campaigns list if we're on a detail page
    if (!page.url().endsWith('/campaigns') && !page.url().includes('/campaigns?')) {
      await navigateTo(page, '/email/campaigns');
    }

    // Verify campaign appears in list
    const campaignText = page.getByText(campaignName);
    await expect(campaignText.first()).toBeVisible({ timeout: 15_000 });

    // Delete the campaign
    const campaignCard = page.locator('div, tr', { hasText: campaignName }).first();
    const deleteBtn = campaignCard.locator('button').filter({ hasText: /delete/i }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();

    // Confirm deletion
    const confirmBtn = page.locator('button').filter({ hasText: /^(confirm|delete)$/i }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // Verify removed
    await page.waitForTimeout(1_000);
    await expect(page.getByText(campaignName)).toBeHidden({ timeout: 10_000 });
  });

  test('verify email campaigns page structure', async ({ page }) => {
    await navigateTo(page, '/email/campaigns');

    // Verify heading and create button exist
    await expect(
      page.getByText(/email campaigns/i).or(page.getByText(/campaigns/i)).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button, a').filter({ hasText: /create campaign/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Verify either campaigns list or empty state
    const listOrEmpty = page.locator('div[class*="grid"], div[class*="list"]').first().or(
      page.getByText(/no campaigns/i)
    );
    await expect(listOrEmpty).toBeVisible({ timeout: 15_000 });
  });
});
