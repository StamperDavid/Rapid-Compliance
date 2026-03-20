/**
 * Content / Video E2E Tests
 *
 * Verifies that the AI Video Studio, standalone Video Editor, Media Library,
 * and Content Generator tabs all load correctly for an authenticated user.
 *
 * No video generation is triggered — tests are limited to UI structure.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

test.describe('Content Video Hub — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // ── AI Video Studio (/content/video) ──────────────────────────────────────

  test('video studio page loads with pipeline stepper', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page heading — "AI Video Studio" with "Studio" in an amber span
    await expect(page.locator('h1', { hasText: 'AI Video' })).toBeVisible({
      timeout: 15_000,
    });

    // Pipeline stepper must render its 5 step labels
    // PIPELINE_STEP_LABELS: Studio, Storyboard, Generate, Assembly, Post-Production
    const expectedSteps = ['Studio', 'Storyboard', 'Generate', 'Assembly', 'Post-Production'];
    for (const label of expectedSteps) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 15_000 });
    }

    // Project control buttons rendered in the header
    await expect(page.locator('button', { hasText: 'New Project' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('button', { hasText: 'Load Project' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('content generator SubpageNav renders all five tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for the heading so we know the page is hydrated
    await expect(page.locator('h1', { hasText: 'AI Video' })).toBeVisible({
      timeout: 15_000,
    });

    // CONTENT_GENERATOR_TABS: Video, Image, Editor, Library, Audio Lab
    const expectedTabs = ['Video', 'Image', 'Editor', 'Library', 'Audio Lab'];
    for (const label of expectedTabs) {
      await expect(page.locator(`a`, { hasText: label }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  // ── Video Editor (/content/video/editor) ──────────────────────────────────

  test('standalone video editor page loads with timeline area', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video/editor`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page heading contains "Video Editor"
    await expect(page.locator('h1', { hasText: 'Video Editor' })).toBeVisible({
      timeout: 15_000,
    });

    // The empty state instructs the user to add clips
    // (the Scissors icon + "Add clips to get started" message are always visible
    //  when no project is pre-loaded via ?project= param)
    await expect(page.locator('text=Add clips to get started')).toBeVisible({
      timeout: 15_000,
    });

    // Assemble button is always present (disabled when clips.length < 1)
    await expect(
      page.locator('button', { hasText: /Assemble/ })
    ).toBeVisible({ timeout: 15_000 });

    // Keyboard shortcut bar anchored at the bottom
    await expect(page.locator('text=Play/Pause').first()).toBeVisible({ timeout: 15_000 });
  });

  test('video editor SubpageNav renders content generator tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video/editor`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('h1', { hasText: 'Video Editor' })).toBeVisible({
      timeout: 15_000,
    });

    const expectedTabs = ['Video', 'Image', 'Editor', 'Library', 'Audio Lab'];
    for (const label of expectedTabs) {
      await expect(page.locator(`a`, { hasText: label }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  // ── Media Library (/content/video/library) ────────────────────────────────

  test('media library page loads with Videos / Images / Audio tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video/library`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page heading
    await expect(page.locator('h1', { hasText: 'Media Library' })).toBeVisible({
      timeout: 15_000,
    });

    // Media type tabs defined in MEDIA_TABS constant
    await expect(page.locator('button', { hasText: 'Videos' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('button', { hasText: 'Images' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('button', { hasText: 'Audio' })).toBeVisible({
      timeout: 15_000,
    });

    // Upload button is always present in the header
    await expect(page.locator('button', { hasText: 'Upload' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('media library videos tab shows project list or empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/video/library`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('h1', { hasText: 'Media Library' })).toBeVisible({
      timeout: 15_000,
    });

    // Videos tab is active by default — wait for the loading spinner to clear
    // then assert either a project card grid or the empty-state message
    const projectGrid = page.locator('.grid').first();
    const emptyState = page.locator('text=No videos yet');
    const loadingSpinner = page.locator('[class*="animate-spin"]').first();

    // Allow time for the API call to resolve
    await expect(loadingSpinner).toBeHidden({ timeout: 15_000 }).catch(() => {
      // Spinner may not exist at all — that's fine
    });

    await expect(projectGrid.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });
});
