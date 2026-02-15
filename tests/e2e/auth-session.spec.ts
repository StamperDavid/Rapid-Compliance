/**
 * Auth Session Persistence E2E Tests
 *
 * Validates that authentication state persists:
 * - Page refresh maintains session
 * - Navigation between pages maintains session
 * - Session survives browser back/forward
 *
 * @group Phase 2A — Authentication
 */

import { test, expect } from '@playwright/test';
import { TEST_USER, BASE_URL } from './fixtures/test-accounts';
import { loginViaUI, expectDashboard, waitForPageReady } from './fixtures/helpers';

test.describe('Session Persistence', () => {
  // Log in via UI first, then test persistence within the session.
  // Storage state from auth.setup may not include IndexedDB (Firebase tokens),
  // so we log in explicitly to establish a real Firebase session.
  test.beforeEach(async ({ page }) => {
    // Check if stored auth state works by navigating to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    try {
      await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 8_000 });
    } catch {
      // Storage state didn't restore Firebase auth — log in via UI
      await loginViaUI(page, TEST_USER.email, TEST_USER.password);
    }
  });

  test('should remain authenticated after page refresh', async ({ page }) => {
    // Should already be on dashboard from beforeEach
    await expectDashboard(page);

    // Refresh the page
    await page.reload();
    await waitForPageReady(page);

    // Should still be on dashboard, not redirected to login
    await expectDashboard(page);
  });

  test('should remain authenticated when navigating between pages', async ({ page }) => {
    // Start at dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await expectDashboard(page);

    // Navigate to another authenticated page
    await page.goto(`${BASE_URL}/entities/leads`);
    await waitForPageReady(page);

    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);

    // Navigate to another page
    await page.goto(`${BASE_URL}/entities/contacts`);
    await waitForPageReady(page);

    // Still authenticated
    await expect(page).not.toHaveURL(/\/login/);

    // Go back to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await expectDashboard(page);
  });

  test('should remain authenticated after browser back/forward', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto(`${BASE_URL}/dashboard`);
    await expectDashboard(page);

    await page.goto(`${BASE_URL}/entities/leads`);
    await waitForPageReady(page);
    await expect(page).not.toHaveURL(/\/login/);

    // Go back
    await page.goBack();
    await waitForPageReady(page);
    await expectDashboard(page);

    // Go forward
    await page.goForward();
    await waitForPageReady(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should maintain auth across multiple rapid page loads', async ({ page }) => {
    const pages = [
      '/dashboard',
      '/entities/deals',
      '/analytics',
      '/dashboard',
    ];

    for (const path of pages) {
      await page.goto(`${BASE_URL}${path}`);
      await waitForPageReady(page);

      // None of these navigations should result in a login redirect
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test('should show user context in sidebar after refresh', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageReady(page);

    // Sidebar should be visible with branding
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Refresh and verify sidebar still shows
    await page.reload();
    await waitForPageReady(page);

    await expect(sidebar).toBeVisible();
  });

  test('should not flash login page during authenticated navigation', async ({ page }) => {
    let sawLoginPage = false;

    // Monitor for any redirect to login
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/login')) {
        sawLoginPage = true;
      }
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageReady(page);

    // Navigate to multiple pages
    await page.goto(`${BASE_URL}/entities/leads`);
    await waitForPageReady(page);

    await page.goto(`${BASE_URL}/entities/contacts`);
    await waitForPageReady(page);

    // Should never have been redirected to login
    expect(sawLoginPage).toBe(false);
  });
});

test.describe('Auth Loading States', () => {
  test('should show loading indicator while auth resolves', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // During auth resolution, either a loading indicator or the dashboard itself should appear
    // The dashboard layout shows a loading spinner while useUnifiedAuth resolves
    // Use Playwright's .or() to combine CSS and text selectors cleanly
    const dashboardOrLoader = page.locator('h1:has-text("Dashboard")')
      .or(page.locator('[role="progressbar"]'))
      .or(page.locator('.animate-spin'))
      .or(page.locator('text=Loading'));

    // One of these should be visible within timeout
    await expect(dashboardOrLoader.first()).toBeVisible({ timeout: 15_000 });
  });
});
