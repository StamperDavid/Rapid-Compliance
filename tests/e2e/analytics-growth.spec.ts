/**
 * Analytics & Growth E2E Tests
 *
 * Verifies that analytics, growth intelligence, battlecards, performance, and
 * A/B tests pages all load correctly for an authenticated user.
 *
 * Tests assert structural presence only — no specific metric values are checked.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

test.describe('Analytics — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // ── Analytics Dashboard (/analytics) ─────────────────────────────────────

  test('analytics dashboard loads with heading and period selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // The page renders a loading state while fetching, then the full dashboard.
    // Wait for auth loading to resolve and the dashboard heading to appear.
    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // Period selector buttons: 7D, 30D, 90D, All Time
    const periodButtons = ['7D', '30D', '90D', 'All Time'];
    for (const label of periodButtons) {
      await expect(
        page.locator('button', { hasText: label })
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('analytics dashboard KPI card containers render', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // KPI card labels are always rendered (values may be $0 / 0 for empty data)
    const kpiLabels = ['Total Revenue', 'Pipeline Value', 'Win Rate', 'E-Commerce Orders'];
    for (const label of kpiLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('analytics SubpageNav renders overview and sub-section tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // ANALYTICS_TABS: Overview, Revenue, CRM Analytics, E-Commerce, etc.
    const expectedTabs = ['Overview', 'Revenue', 'CRM Analytics', 'E-Commerce', 'Workflows'];
    for (const label of expectedTabs) {
      await expect(page.locator(`a`, { hasText: label }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('analytics quick-access cards render with view links', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Analytics Dashboard' })
    ).toBeVisible({ timeout: 15_000 });

    // Quick access card titles from quickAccessCards array
    const cardTitles = [
      'Revenue Analytics',
      'Pipeline Analytics',
      'E-Commerce Analytics',
      'Workflow Analytics',
    ];
    for (const title of cardTitles) {
      await expect(page.locator(`h3`, { hasText: title })).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('Growth — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // ── Growth Command Center (/growth/command-center) ────────────────────────

  test('growth command center loads with competitor and keyword stat cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/growth/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Loading state or final heading
    const heading = page.locator('h1', { hasText: 'Growth Command Center' });
    const loadingMsg = page.locator('text=Loading Growth Command Center');
    await expect(heading.or(loadingMsg)).toBeVisible({ timeout: 15_000 });

    // Wait for loading to resolve
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Stat card labels rendered unconditionally (values may be 0 / N/A)
    await expect(page.locator('text=Competitors').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Keywords Tracked').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=AI Visibility').first()).toBeVisible({ timeout: 15_000 });
  });

  test('growth SubpageNav renders expected tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/growth/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Growth Command Center' })
    ).toBeVisible({ timeout: 15_000 });

    // GROWTH_TABS: Command Center, Competitors, Keywords, Strategy, AI Visibility, Activity
    const expectedTabs = [
      'Command Center',
      'Competitors',
      'Keywords',
      'Strategy',
      'AI Visibility',
      'Activity',
    ];
    for (const label of expectedTabs) {
      await expect(page.locator(`a`, { hasText: label }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});

test.describe('Battlecards — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('battlecards page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/battlecards`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/battlecards');
  });

  test('battlecards page renders analytics SubpageNav', async ({ page }) => {
    await page.goto(`${BASE_URL}/battlecards`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // The battlecards page uses ANALYTICS_TABS which includes "Competitor Research"
    await expect(
      page.locator('a', { hasText: 'Competitor Research' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Performance — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('performance dashboard loads with period selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/performance`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/performance');

    // Period selector: week, month, quarter buttons are always rendered
    const weekBtn = page.locator('button', { hasText: /week/i });
    const monthBtn = page.locator('button', { hasText: /month/i });
    const quarterBtn = page.locator('button', { hasText: /quarter/i });
    await expect(weekBtn.or(monthBtn).or(quarterBtn)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('A/B Tests — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('ab-tests page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/ab-tests`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/ab-tests');
  });
});
