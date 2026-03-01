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
 *
 * Retries up to 2 times on Firebase quota errors (auth/quota-exceeded)
 * which occur when multiple workers hit Firebase auth simultaneously.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  options?: { expectDashboard?: boolean }
): Promise<void> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'load', timeout: 60_000 });

    // Wait for React hydration — submit button must be enabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });

    // Fill credentials (click first to ensure focus in controlled inputs)
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.click();
    await emailInput.fill(email);
    await passwordInput.click();
    await passwordInput.fill(password);

    await submitBtn.click();

    if (options?.expectDashboard !== false) {
      // Race between dashboard navigation and quota error
      const quotaError = page.locator('text=quota-exceeded').or(page.locator('text=Exceeded quota'));
      const dashboardResult = await Promise.race([
        page.waitForURL('**/dashboard', { waitUntil: 'commit', timeout: 30_000 })
          .then(() => 'dashboard' as const),
        quotaError.waitFor({ timeout: 30_000 })
          .then(() => 'quota' as const),
      ]).catch(() => 'timeout' as const);

      if (dashboardResult === 'quota' && attempt < maxRetries) {
        // Wait before retrying — Firebase quota resets after a short delay
        await page.waitForTimeout(5_000 * (attempt + 1));
        continue;
      }

      if (dashboardResult !== 'dashboard') {
        // Final attempt or non-quota failure — try waiting for dashboard directly
        await page.waitForURL('**/dashboard', { waitUntil: 'commit', timeout: 60_000 });
      }

      await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    }

    // Login succeeded
    return;
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
  await page.goto(`${BASE_URL}/admin-login`, { waitUntil: 'load', timeout: 60_000 });

  // Wait for Firebase to initialize (button disabled until isFirebaseReady)
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled({ timeout: 15_000 });

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.click();
  await emailInput.fill(email);
  await passwordInput.click();
  await passwordInput.fill(password);

  await submitBtn.click();
  await page.waitForURL('**/dashboard', { waitUntil: 'commit', timeout: 60_000 });
}

/**
 * Assert that the user is on the dashboard page.
 */
export async function expectDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  // Dashboard h1 or sidebar visible confirms auth resolved and page rendered
  const h1 = page.locator('h1');
  const sidebar = page.locator('aside');
  await expect(h1.or(sidebar).first()).toBeVisible({ timeout: 20_000 });
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
    // Check if we're already on the dashboard with an active session.
    // Firebase auth resolution from storage state can take 15-20s on dev server.
    await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 });
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
