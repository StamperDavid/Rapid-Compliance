/**
 * Social Media E2E Tests
 *
 * Verifies that all social hub pages load correctly for an authenticated user.
 * Tests are scoped to page-load and structural presence — no data mutations.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

test.describe('Social Hub — page loads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // ── Command Center ─────────────────────────────────────────────────────────

  test('command center loads with agent status banner and activity feed', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for the loading state to resolve (the page fetches data on mount)
    // Either the heading or the loading message will be visible first
    const heading = page.locator('h1', { hasText: 'Command Center' });
    const loadingMsg = page.locator('text=Loading Command Center');

    // Give the loading state a moment then wait for it to clear
    await expect(heading.or(loadingMsg)).toBeVisible({ timeout: 15_000 });

    // If it was loading, wait for the real heading to appear
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Agent status banner: shows either "AI Agent is Active" or "AI Agent is Paused"
    const agentBanner = page
      .locator('text=AI Agent is Active')
      .or(page.locator('text=AI Agent is Paused'));
    await expect(agentBanner).toBeVisible({ timeout: 15_000 });

    // Activity feed section heading
    await expect(page.locator('h2', { hasText: 'Recent Activity' })).toBeVisible({
      timeout: 15_000,
    });

    // Connected Platforms section heading
    await expect(page.locator('h2', { hasText: 'Connected Platforms' })).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── Calendar ──────────────────────────────────────────────────────────────

  test('calendar page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/calendar`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Sidebar confirms authenticated layout
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // Page should not redirect to login
    expect(page.url()).toContain('/social/calendar');
  });

  // ── Approvals ─────────────────────────────────────────────────────────────

  test('approvals page loads with approval queue', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/approvals`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/social/approvals');

    // The approval queue renders a heading or status tabs.
    // Pending Review is always a tab; allow a generous timeout for API data.
    const pendingTab = page.locator('text=Pending Review');
    const approvedTab = page.locator('text=Approved');
    const queueIndicator = pendingTab.or(approvedTab);
    await expect(queueIndicator).toBeVisible({ timeout: 15_000 });
  });

  // ── Listening ─────────────────────────────────────────────────────────────

  test('listening page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/listening`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/social/listening');
  });

  // ── Playbook ──────────────────────────────────────────────────────────────

  test('playbook page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/playbook`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/social/playbook');
  });

  // ── Training ──────────────────────────────────────────────────────────────

  test('training page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/training`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/social/training');
  });

  // ── Agent Rules ───────────────────────────────────────────────────────────

  test('agent-rules page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/agent-rules`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/social/agent-rules');
  });

  // ── SubpageNav tabs ───────────────────────────────────────────────────────

  test('social hub SubpageNav renders the expected tab set', async ({ page }) => {
    await page.goto(`${BASE_URL}/social/command-center`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for the heading so we know the page has rendered
    await expect(page.locator('h1', { hasText: 'Command Center' })).toBeVisible({
      timeout: 15_000,
    });

    // The SOCIAL_TABS definition exposes these labels in the SubpageNav
    const expectedTabs = [
      'Command Center',
      'Campaigns',
      'Calendar',
      'Approvals',
      'Listening',
      'Agent Rules',
      'Playbook',
    ];

    for (const label of expectedTabs) {
      await expect(page.locator(`a`, { hasText: label }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
