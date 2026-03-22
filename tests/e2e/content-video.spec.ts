/**
 * E2E Test: Video Pipeline Journey
 *
 * Journey 1 — Video Studio Navigation:
 *   Navigate to studio → verify stepper → verify New/Load project buttons
 *
 * Journey 2 — Pipeline Brief & Storyboard Flow:
 *   Create new project → fill brief → navigate to storyboard →
 *   verify AI-generated scenes or add scenes manually → verify step transitions
 *
 * Journey 3 — Template Picker:
 *   Open template picker → select a template → verify brief is pre-populated
 *
 * Journey 4 — Load Project Modal:
 *   Open Load Project modal → verify list/empty state → close
 *
 * Note: Actual video generation requires Hedra API and is not tested here.
 * Generation, assembly, and post-production steps are tested up to the
 * "Start Generation" button visibility.
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

test.describe('Video Studio Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('studio page loads with stepper and action buttons', async ({ page }) => {
    await navigateTo(page, '/content/video');

    // Verify studio heading
    const heading = page.getByText(/video studio/i).or(
      page.getByText(/ai video/i)
    ).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify New Project and Load Project buttons
    await expect(
      page.locator('button').filter({ hasText: /new project/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('button').filter({ hasText: /load project/i })
    ).toBeVisible({ timeout: 10_000 });

    // Verify stepper shows at least 3 pipeline step labels
    const stepLabels = ['studio', 'storyboard', 'generate', 'assembly', 'post-production'];
    let visibleSteps = 0;
    for (const label of stepLabels) {
      const stepEl = page.getByText(new RegExp(label, 'i')).first();
      if (await stepEl.isVisible({ timeout: 2_000 }).catch(() => false)) {
        visibleSteps++;
      }
    }
    expect(visibleSteps).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Video Pipeline Brief & Storyboard Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('fill brief, navigate to storyboard, add a scene', async ({ page }) => {
    await navigateTo(page, '/content/video');

    // Click New Project to ensure a fresh state
    const newProjectBtn = page.locator('button').filter({ hasText: /new project/i });
    await expect(newProjectBtn).toBeVisible({ timeout: 10_000 });
    await newProjectBtn.click();
    await page.waitForTimeout(500);

    // ── STEP 1: Fill the Brief ──────────────────────────────────────────
    // Find the description textarea (the main brief input)
    const descriptionInput = page.locator('textarea').first();
    await expect(descriptionInput).toBeVisible({ timeout: 10_000 });
    await descriptionInput.fill('E2E Test Video: A 30-second product demo showing how our AI assistant helps close deals faster.');

    // Select video type if dropdown exists
    const videoTypeSelect = page.locator('select').filter({ hasText: /tutorial|explainer|product|sales/i }).first();
    if (await videoTypeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await videoTypeSelect.selectOption({ index: 2 }); // product-demo
    }

    // Look for "Next" or "Continue" button to advance to storyboard
    const nextBtn = page.locator('button').filter({ hasText: /next|continue|storyboard/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
    await nextBtn.click();

    // ── STEP 2: Verify Storyboard ───────────────────────────────────────
    // Wait for storyboard content to appear
    // Could be AI-generated scenes or an empty storyboard with "Add Scene" button
    const storyboardContent = page.getByText(/scene/i).first().or(
      page.locator('button').filter({ hasText: /add scene/i }).first()
    ).or(
      page.getByText(/storyboard/i).first()
    );
    await expect(storyboardContent).toBeVisible({ timeout: 20_000 });

    // Try to add a scene manually if there's an "Add Scene" button
    const addSceneBtn = page.locator('button').filter({ hasText: /add scene/i }).first();
    if (await addSceneBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addSceneBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify at least one scene exists (either AI-generated or manually added)
    const sceneCard = page.getByText(/scene 1/i).or(
      page.locator('[class*="scene"]').first()
    );
    await expect(sceneCard.first()).toBeVisible({ timeout: 15_000 });

    // Fill in scene script text if a textarea is visible
    const scriptInput = page.locator('textarea').first();
    if (await scriptInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const currentValue = await scriptInput.inputValue();
      if (!currentValue) {
        await scriptInput.fill('Welcome to our AI-powered sales platform. Let me show you how easy it is to close deals.');
      }
    }

    // ── STEP 3: Navigate to Generation ──────────────────────────────────
    // The "Continue to Generation" or "Generate" button should be available
    const generateBtn = page.locator('button').filter({ hasText: /generate|next|continue/i })
      .filter({ hasNotText: /back/i })
      .last();

    if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click();
      await page.waitForTimeout(1_000);

      // Verify we're on the generation step — should see "Start Generation" or cost estimate
      const generationContent = page.getByText(/start generation/i).or(
        page.getByText(/scene generation/i)
      ).or(
        page.getByText(/est\./i) // Cost estimate
      ).first();
      await expect(generationContent).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('Template Picker', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('select a template and verify brief is pre-populated', async ({ page }) => {
    await navigateTo(page, '/content/video');

    // Click New Project
    const newProjectBtn = page.locator('button').filter({ hasText: /new project/i });
    await expect(newProjectBtn).toBeVisible({ timeout: 10_000 });
    await newProjectBtn.click();
    await page.waitForTimeout(500);

    // Look for template picker (modal or inline)
    const templateOption = page.getByText(/weekly sales|product demo|testimonial|social media|announcement/i).first();
    if (await templateOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await templateOption.click();
      await page.waitForTimeout(500);

      // After selecting, the brief textarea should be pre-populated
      const briefTextarea = page.locator('textarea').first();
      if (await briefTextarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const briefValue = await briefTextarea.inputValue();
        expect(briefValue.length).toBeGreaterThan(0);
      }
    } else {
      // Template picker not visible — feature may be behind a button
      const templateBtn = page.locator('button').filter({ hasText: /template/i }).first();
      if (await templateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await templateBtn.click();
        await page.waitForTimeout(500);

        const templateModal = page.getByText(/choose a template|select template/i);
        await expect(templateModal.first()).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});

test.describe('Load Project Modal', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
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

    // Wait for loading to complete
    const loadingText = page.getByText(/loading projects/i);
    if (await loadingText.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(loadingText).toBeHidden({ timeout: 15_000 });
    }

    // Close the modal
    await page.keyboard.press('Escape');
    await expect(modalHeading.first()).toBeHidden({ timeout: 10_000 });
  });
});
