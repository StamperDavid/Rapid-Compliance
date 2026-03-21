/**
 * E2E Test: Social Posting Journey
 *
 * Tests the social media posting flow:
 *   1. Navigate to social campaigns page
 *   2. Switch to Manual mode
 *   3. Create a new social post (compose content, select platform)
 *   4. Verify the post appears in the posts list
 *   5. Delete the post
 *   6. Verify the post is removed
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

test.describe('Social Posting Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('create, verify, and delete a social post', async ({ page }) => {
    await navigateTo(page, '/social/campaigns');

    const postContent = `E2E Test Post ${Date.now()} - Automated test content`;

    // Verify page heading
    const heading = page.getByText(/content studio/i).or(
      page.getByText(/social/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Switch to Manual mode if not already
    const manualBtn = page.locator('button').filter({ hasText: /manual/i });
    if (await manualBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await manualBtn.click();
      await page.waitForTimeout(500);
    }

    // Click New Post button
    const newPostBtn = page.locator('button').filter({ hasText: /new post/i }).or(
      page.locator('button').filter({ hasText: /create post/i })
    ).or(
      page.locator('button').filter({ hasText: /compose/i })
    ).first();
    await expect(newPostBtn).toBeVisible({ timeout: 10_000 });
    await newPostBtn.click();

    // Wait for modal/form to appear
    const modalHeading = page.locator('h2, h3').filter({ hasText: /new.*post|create.*post/i }).or(
      page.getByText(/compose/i)
    );
    await expect(modalHeading.first()).toBeVisible({ timeout: 10_000 });

    // Select platform (Twitter/X is most commonly available)
    const platformSelect = page.locator('select').filter({ hasText: /platform/i }).or(
      page.getByLabel(/platform/i)
    ).first();
    if (await platformSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await platformSelect.selectOption({ index: 1 }); // Select first non-default option
    }

    // Fill content
    const contentField = page.getByPlaceholder(/write your post/i).or(
      page.getByPlaceholder(/content/i)
    ).or(
      page.locator('textarea').first()
    );
    await expect(contentField).toBeVisible({ timeout: 5_000 });
    await contentField.fill(postContent);

    // Set status to Draft (safe — no actual posting)
    const statusSelect = page.getByLabel(/status/i).or(
      page.locator('select').nth(1)
    );
    if (await statusSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await statusSelect.selectOption('draft');
    }

    // Submit
    const createBtn = page.locator('button').filter({ hasText: /create post/i }).or(
      page.locator('button').filter({ hasText: /^save$/i })
    ).or(
      page.locator('button').filter({ hasText: /^post$/i })
    ).first();
    await createBtn.click();

    // Wait for modal to close
    await expect(modalHeading.first()).toBeHidden({ timeout: 10_000 }).catch(() => {});

    // Verify post appears in list
    await page.waitForTimeout(1_000);

    // Navigate to Posts tab if not already there
    const postsTab = page.locator('button').filter({ hasText: /posts/i }).first();
    if (await postsTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await postsTab.click();
      await page.waitForTimeout(1_000);
    }

    const postText = page.getByText(postContent.substring(0, 30)); // Match partial text
    await expect(postText.first()).toBeVisible({ timeout: 15_000 });

    // Delete the post
    const postRow = page.locator('tr, div', { hasText: postContent.substring(0, 30) }).first();
    const deleteBtn = postRow.locator('button').filter({ hasText: /delete/i }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Confirm deletion
    const confirmBtn = page.locator('button').filter({ hasText: /^(confirm|delete)$/i }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // Verify removed
    await page.waitForTimeout(1_000);
    await expect(page.getByText(postContent.substring(0, 30))).toBeHidden({ timeout: 10_000 });
  });

  test('verify autopilot mode displays agent status', async ({ page }) => {
    await navigateTo(page, '/social/campaigns');

    // Switch to Autopilot mode
    const autopilotBtn = page.locator('button').filter({ hasText: /autopilot/i });
    if (await autopilotBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await autopilotBtn.click();
      await page.waitForTimeout(500);

      // Verify agent status banner appears
      const agentStatus = page.getByText(/ai agent/i).first();
      await expect(agentStatus).toBeVisible({ timeout: 15_000 });
    }
  });
});
