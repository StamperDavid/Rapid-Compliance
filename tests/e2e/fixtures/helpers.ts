/**
 * Shared E2E Test Helpers
 *
 * Utility functions used across multiple test files.
 */

import { type Page, expect } from '@playwright/test';
import { BASE_URL } from './test-accounts';

/**
 * Log in via the UI login form. Used in tests that need fresh auth
 * (e.g., login tests, RBAC tests) rather than reusing stored state.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  options?: { expectDashboard?: boolean }
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  if (options?.expectDashboard !== false) {
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
  }
}

/**
 * Log in via the admin login form.
 */
export async function adminLoginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${BASE_URL}/admin-login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

/**
 * Assert that the user is on the dashboard page.
 */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('h1')).toContainText('Dashboard');
}

/**
 * Assert that a sidebar navigation link is visible.
 */
export async function expectSidebarLink(
  page: Page,
  href: string,
  shouldExist: boolean
): Promise<void> {
  const link = page.locator(`aside a[href="${href}"]`);
  if (shouldExist) {
    await expect(link).toBeVisible();
  } else {
    await expect(link).toBeHidden();
  }
}

/**
 * Wait for the page to finish loading (no pending network requests).
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Generate a unique test slug to avoid collisions between test runs.
 */
export function uniqueSlug(prefix: string): string {
  return `${prefix}-e2e-${Date.now()}`;
}

/**
 * Dismiss any toast/notification that might block interactions.
 */
export async function dismissToast(page: Page): Promise<void> {
  const toast = page.locator('[role="alert"], [data-testid="toast"]');
  if (await toast.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Click the close button if present, otherwise wait for auto-dismiss
    const closeBtn = toast.locator('button');
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click();
    }
  }
}
