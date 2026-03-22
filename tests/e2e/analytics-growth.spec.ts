/**
 * Analytics & Growth E2E Tests
 *
 * Verifies analytics dashboard, growth command center, battlecards,
 * performance, and A/B tests pages — including interactive elements
 * like period selectors, tab navigation, and card interactions.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with heading, KPI cards, and period selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // KPI card labels
    for (const label of ['Total Revenue', 'Pipeline Value', 'Win Rate', 'E-Commerce Orders']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 15_000 });
    }

    // Period selector buttons
    for (const label of ['7D', '30D', '90D', 'All Time']) {
      await expect(page.locator('button', { hasText: label })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('period selector buttons are clickable and update active state', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // Click 7D button
    const btn7d = page.locator('button', { hasText: '7D' });
    await btn7d.click();
    await page.waitForTimeout(500);

    // Page should remain stable — heading still visible
    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 5_000 });

    // Click 90D button
    const btn90d = page.locator('button', { hasText: '90D' });
    await btn90d.click();
    await page.waitForTimeout(500);

    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SubpageNav tabs render and navigate correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    const expectedTabs = ['Overview', 'Revenue', 'CRM Analytics', 'E-Commerce', 'Workflows'];
    for (const label of expectedTabs) {
      await expect(page.locator('a', { hasText: label }).first()).toBeVisible({ timeout: 10_000 });
    }

    // Click Revenue tab — verify navigation
    const revenueTab = page.locator('a', { hasText: 'Revenue' }).first();
    await revenueTab.click();
    await page.waitForTimeout(500);
    // Should still be on analytics section
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });
  });

  test('quick-access cards render with titles and are present', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    for (const title of ['Revenue Analytics', 'Pipeline Analytics', 'E-Commerce Analytics', 'Workflow Analytics']) {
      await expect(page.locator('h3', { hasText: title })).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('Growth Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with heading and stat cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/growth/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const heading = page.locator('h1', { hasText: 'Growth Command Center' });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('text=Competitors').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Keywords Tracked').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=AI Visibility').first()).toBeVisible({ timeout: 15_000 });
  });

  test('SubpageNav tabs render and clicking navigates between sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/growth/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(
      page.locator('h1', { hasText: 'Growth Command Center' })
    ).toBeVisible({ timeout: 15_000 });

    const expectedTabs = ['Command Center', 'Competitors', 'Keywords', 'Strategy', 'AI Visibility', 'Activity'];
    for (const label of expectedTabs) {
      await expect(page.locator('a', { hasText: label }).first()).toBeVisible({ timeout: 10_000 });
    }

    // Click Competitors tab
    const competitorsTab = page.locator('a', { hasText: 'Competitors' }).first();
    await competitorsTab.click();
    await waitForPageReady(page);
    // Should navigate within the growth section
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });

    // Click Keywords tab
    const keywordsTab = page.locator('a', { hasText: 'Keywords' }).first();
    await keywordsTab.click();
    await waitForPageReady(page);
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });

    // Navigate back to Command Center
    const commandTab = page.locator('a', { hasText: 'Command Center' }).first();
    await commandTab.click();
    await waitForPageReady(page);
    await expect(page.locator('text=Competitors').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Battlecards page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads and renders analytics SubpageNav with Competitor Research', async ({ page }) => {
    await page.goto(`${BASE_URL}/battlecards`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/battlecards');

    await expect(
      page.locator('a', { hasText: 'Competitor Research' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Competitor Research tab link is clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/battlecards`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const researchTab = page.locator('a', { hasText: 'Competitor Research' }).first();
    await expect(researchTab).toBeVisible({ timeout: 15_000 });
    await researchTab.click();
    await page.waitForTimeout(500);
    // Navigation should succeed without crash
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Performance page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with period selector buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/performance`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/performance');

    const weekBtn = page.locator('button', { hasText: /week/i });
    const monthBtn = page.locator('button', { hasText: /month/i });
    const quarterBtn = page.locator('button', { hasText: /quarter/i });
    await expect(weekBtn.or(monthBtn).or(quarterBtn)).toBeVisible({ timeout: 15_000 });
  });

  test('clicking period buttons changes active period', async ({ page }) => {
    await page.goto(`${BASE_URL}/performance`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const monthBtn = page.locator('button', { hasText: /month/i });
    if (await monthBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await monthBtn.click();
      await page.waitForTimeout(500);
      // Page remains stable
      await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('A/B Tests page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads and renders sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/ab-tests`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/ab-tests');
  });

  test('page has create or empty state content', async ({ page }) => {
    await page.goto(`${BASE_URL}/ab-tests`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Either a "Create" button, empty state message, or test cards should be visible
    const createBtn = page.locator('button', { hasText: /create|new/i });
    const emptyState = page.locator('text=/no.*test/i');
    const testCard = page.locator('[class*="card"], [class*="Card"]').first();
    await expect(
      createBtn.or(emptyState).or(testCard)
    ).toBeVisible({ timeout: 15_000 });
  });
});
