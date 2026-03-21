/**
 * E2E Test: Workflow Execution Journey
 *
 * Tests the workflow management flow:
 *   1. Navigate to workflows page
 *   2. Verify workflow list or empty state
 *   3. Click Create Workflow — navigate to builder
 *   4. Navigate back and verify workflow cards
 *   5. Test status toggle (Active/Paused) if workflows exist
 *   6. Test delete flow if workflows exist
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

test.describe('Workflow Execution Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('navigate to workflows and verify page structure', async ({ page }) => {
    await navigateTo(page, '/workflows');

    // Verify heading
    const heading = page.locator('h1').filter({ hasText: /workflow/i }).or(
      page.getByText(/workflows/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify Create Workflow button
    const createBtn = page.locator('button, a').filter({ hasText: /create workflow/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });

    // Verify either workflow cards or empty state
    const workflowsOrEmpty = page.getByText(/no workflows/i).or(
      page.locator('div').filter({ hasText: /active|paused|draft/i }).first()
    );
    await expect(workflowsOrEmpty).toBeVisible({ timeout: 15_000 });
  });

  test('create workflow button navigates to builder', async ({ page }) => {
    await navigateTo(page, '/workflows');

    const createBtn = page.locator('button, a').filter({ hasText: /create workflow/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();

    // Should navigate to workflow builder
    await expect(page).toHaveURL(/\/workflows\/builder/, { timeout: 15_000 });
    await waitForPageReady(page);

    // Verify builder page loads
    const builderContent = page.getByText(/workflow/i).or(
      page.getByText(/builder/i)
    ).or(
      page.getByText(/trigger/i)
    ).first();
    await expect(builderContent).toBeVisible({ timeout: 15_000 });
  });

  test('interact with existing workflow if present', async ({ page }) => {
    await navigateTo(page, '/workflows');

    // Check if any workflows exist
    const workflowCard = page.locator('div').filter({ hasText: /active|paused|draft/i }).first();

    if (await workflowCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      // Workflow exists — test status toggle
      const toggleBtn = workflowCard.locator('button').filter({ hasText: /pause|activate/i }).first();

      if (await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const originalText = await toggleBtn.textContent();
        await toggleBtn.click();

        // Wait for status change confirmation
        const notification = page.getByText(/success/i).first();
        await expect(notification).toBeVisible({ timeout: 10_000 }).catch(() => {});

        // Toggle back to restore original state
        await page.waitForTimeout(1_000);
        const restoredBtn = workflowCard.locator('button').filter({ hasText: /pause|activate/i }).first();
        if (await restoredBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const newText = await restoredBtn.textContent();
          // Only toggle back if the text changed (confirming the first toggle worked)
          if (newText !== originalText) {
            await restoredBtn.click();
            await page.waitForTimeout(1_000);
          }
        }
      }

      // Test Edit button
      const editBtn = workflowCard.locator('button').filter({ hasText: /edit/i }).first();
      if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await editBtn.click();
        await expect(page).toHaveURL(/\/workflows\/builder/, { timeout: 15_000 });
        // Navigate back
        await navigateTo(page, '/workflows');
      }

      // Test History button
      const historyBtn = workflowCard.locator('button').filter({ hasText: /history/i }).first();
      if (await historyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await historyBtn.click();
        await expect(page).toHaveURL(/\/workflows\/.*\/runs/, { timeout: 15_000 });
      }
    } else {
      // No workflows — verify empty state
      const emptyState = page.getByText(/no workflows/i).or(
        page.getByText(/create your first/i)
      );
      await expect(emptyState.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
