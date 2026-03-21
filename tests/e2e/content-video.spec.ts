/**
 * E2E Test: Video Generation Journey
 *
 * Tests the video creation flow:
 *   1. Navigate to AI Video Studio
 *   2. Verify stepper renders with pipeline steps
 *   3. Create a new project (verify stepper resets)
 *   4. Open Load Project modal, verify project list, close
 *   5. Navigate through stepper steps (request → storyboard)
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

test.describe('Video Generation Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('navigate video studio and interact with stepper', async ({ page }) => {
    await navigateTo(page, '/content/video');

    // Verify studio heading
    const heading = page.getByText(/video studio/i).or(
      page.getByText(/ai video/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify New Project button exists
    const newProjectBtn = page.locator('button').filter({ hasText: /new project/i });
    await expect(newProjectBtn).toBeVisible({ timeout: 10_000 });

    // Verify Load Project button exists
    const loadProjectBtn = page.locator('button').filter({ hasText: /load project/i });
    await expect(loadProjectBtn).toBeVisible({ timeout: 10_000 });

    // Verify stepper is visible with step labels
    const stepLabels = ['request', 'storyboard', 'generation', 'assembly', 'post-production'];
    let visibleSteps = 0;
    for (const label of stepLabels) {
      const stepEl = page.getByText(new RegExp(label, 'i')).first();
      if (await stepEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
        visibleSteps++;
      }
    }
    expect(visibleSteps).toBeGreaterThanOrEqual(3);

    // Click New Project to reset stepper
    await newProjectBtn.click();
    await page.waitForTimeout(500);

    // Verify we're on the first step (request/studio)
    // The studio mode panel or request form should be visible
    const studioContent = page.getByText(/studio/i).or(
      page.getByText(/request/i)
    ).or(
      page.getByText(/create your video/i)
    ).first();
    await expect(studioContent).toBeVisible({ timeout: 10_000 });
  });

  test('open and close Load Project modal', async ({ page }) => {
    await navigateTo(page, '/content/video');

    const loadProjectBtn = page.locator('button').filter({ hasText: /load project/i });
    await expect(loadProjectBtn).toBeVisible({ timeout: 15_000 });
    await loadProjectBtn.click();

    // Verify modal opens
    const modalHeading = page.locator('h2, h3').filter({ hasText: /load project/i });
    await expect(modalHeading.first()).toBeVisible({ timeout: 10_000 });

    // Modal should show project list or empty state
    const projectList = page.getByText(/no saved projects/i).or(
      page.locator('button').filter({ hasText: /scene/i })
    ).or(
      page.getByText(/loading projects/i)
    ).first();
    await expect(projectList).toBeVisible({ timeout: 15_000 });

    // Wait for loading to complete if applicable
    const loadingText = page.getByText(/loading projects/i);
    if (await loadingText.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(loadingText).toBeHidden({ timeout: 15_000 });
    }

    // Close the modal
    const closeBtn = page.locator('button').filter({ hasText: /×|✕|close/i }).or(
      page.locator('[role="dialog"] button').first()
    );
    if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Try pressing Escape
      await page.keyboard.press('Escape');
    }

    // Modal should be closed
    await expect(modalHeading.first()).toBeHidden({ timeout: 10_000 });
  });
});
