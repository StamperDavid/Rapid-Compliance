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
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  if (options?.expectDashboard !== false) {
    // Wait for the "Redirecting" spinner (confirms Firebase auth succeeded),
    // then wait for client-side navigation to /dashboard
    await page.locator('text=Redirecting').waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForURL('**/dashboard', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait for sidebar to confirm dashboard layout rendered
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
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
 * Wait for the page to finish loading.
 * Uses domcontentloaded instead of networkidle since Firebase/analytics
 * connections may prevent networkidle from resolving.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Give the client-side framework a moment to hydrate and resolve auth
  await page.waitForTimeout(1_000);
}

/**
 * Generate a unique test slug to avoid collisions between test runs.
 */
export function uniqueSlug(prefix: string): string {
  return `${prefix}-e2e-${Date.now()}`;
}

/**
 * Ensure the browser has an active Firebase auth session.
 * Playwright's storageState may not reliably restore Firebase auth
 * (tokens stored in IndexedDB or localStorage may not survive).
 * This checks the dashboard and falls back to UI login if needed.
 */
export async function ensureAuthenticated(
  page: Page,
  email?: string,
  password?: string
): Promise<void> {
  const { TEST_USER } = await import('./test-accounts');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  try {
    // Check if we're already on the dashboard with an active session
    await expect(page.locator('aside')).toBeVisible({ timeout: 10_000 });
  } catch {
    // Storage state didn't restore Firebase auth — log in via UI
    await loginViaUI(
      page,
      email ?? TEST_USER.email,
      password ?? TEST_USER.password
    );
  }
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
