/**
 * Outreach Feature E2E Tests
 *
 * Covers the outbound sequences, email campaigns, email writer,
 * calls log, and nurture campaigns pages.
 *
 * All tests are read-only — no data is created or mutated.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Auth setup: ensure a valid session before every test
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});

// ---------------------------------------------------------------------------
// /outbound/sequences
// ---------------------------------------------------------------------------

test.describe('Outbound Sequences page', () => {
  test('loads with heading and tab controls', async ({ page }) => {
    await page.goto(`${BASE_URL  }/outbound/sequences`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page heading is always rendered regardless of data state
    await expect(
      page.locator('h1', { hasText: 'Email Sequences' })
    ).toBeVisible({ timeout: 15_000 });

    // The "Sequences" tab button is always rendered
    await expect(
      page.locator('button', { hasText: 'Sequences' })
    ).toBeVisible({ timeout: 15_000 });

    // The "Enrollments" tab button is always rendered
    await expect(
      page.locator('button', { hasText: /Enrollments/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows Create Sequence button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/outbound/sequences`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('button', { hasText: /Create Sequence/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading state resolves — either empty state or sequence cards appear', async ({ page }) => {
    await page.goto(`${BASE_URL  }/outbound/sequences`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for the spinner/loading text to disappear
    await expect(
      page.locator('text=Loading sequences...')
    ).toBeHidden({ timeout: 15_000 });

    // After loading, the sequences tab content renders
    // Either the empty state message or actual sequence cards must be present
    const emptyState = page.locator('text=No sequences yet');
    const sequenceCards = page.locator('[style*="border-radius: 1rem"]').first();
    await expect(emptyState.or(sequenceCards)).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// /email/campaigns
// ---------------------------------------------------------------------------

test.describe('Email Campaigns page', () => {
  test('loads with heading and Create Campaign button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/email/campaigns`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Email Campaigns' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Create Campaign' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading state resolves — empty state or campaign list appears', async ({ page }) => {
    await page.goto(`${BASE_URL  }/email/campaigns`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Either "No campaigns yet" or a campaign row must be visible
    const emptyState = page.locator('h3', { hasText: 'No campaigns yet' });
    // Campaign rows are rendered inside motion.div with a specific class
    const campaignRow = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(campaignRow)).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /email-writer
// ---------------------------------------------------------------------------

test.describe('AI Email Writer page', () => {
  test('loads with heading and BETA badge', async ({ page }) => {
    await page.goto(`${BASE_URL  }/email-writer`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'AI Email Writer' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('text=BETA')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('stats cards are rendered on page load', async ({ page }) => {
    await page.goto(`${BASE_URL  }/email-writer`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Four stats cards are always rendered
    await expect(
      page.locator('text=Emails Generated')
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('text=Emails Sent')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('How It Works section is visible', async ({ page }) => {
    await page.goto(`${BASE_URL  }/email-writer`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h3', { hasText: 'How It Works' })
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /calls
// ---------------------------------------------------------------------------

test.describe('Calls Log page', () => {
  test('loads with heading and Make Call button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/calls`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Call Log' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Make Call' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or calls table appears', async ({ page }) => {
    await page.goto(`${BASE_URL  }/calls`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Either empty state or the calls table container
    const emptyState = page.locator('h3', { hasText: 'No calls yet' });
    const tableContainer = page.locator('table').first();
    await expect(emptyState.or(tableContainer)).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /nurture
// ---------------------------------------------------------------------------

test.describe('Lead Nurture Campaigns page', () => {
  test('loads with heading and Create Campaign button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/nurture`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Lead Nurture Campaigns' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Create Campaign' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or campaign list appears', async ({ page }) => {
    await page.goto(`${BASE_URL  }/nurture`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('h3', { hasText: 'No Nurture Campaigns Yet' });
    const campaignGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(campaignGrid)).toBeVisible({ timeout: 15_000 });
  });
});
