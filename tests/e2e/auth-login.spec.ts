/**
 * E2E Tests: Login Page (/login)
 *
 * Project: no-auth (no stored auth state — runs clean browser context)
 *
 * Covers:
 *  - Page renders core form elements
 *  - Successful login redirects to /dashboard
 *  - Invalid credentials surface an error message
 *  - Forgot-password link navigates correctly
 *  - Already-authenticated user visiting /login is redirected to dashboard
 *
 * NOTE: The login page does NOT include a Google OAuth button — it uses
 * email/password only. The forgot-password link is the only external navigation.
 * No test data is created, so no afterEach cleanup is required.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, TEST_USER } from './fixtures/test-accounts';
import {
  loginViaUI,
  expectDashboard,
  waitForPageReady,
} from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to /login and wait for React hydration to complete. */
async function goToLogin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Login Page', () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  test.describe('Page rendering', () => {
    test('email input is visible', async ({ page }) => {
      await goToLogin(page);
      await expect(page.locator('input[type="email"]')).toBeVisible({
        timeout: 15_000,
      });
    });

    test('password input is visible', async ({ page }) => {
      await goToLogin(page);
      await expect(page.locator('input[type="password"]')).toBeVisible({
        timeout: 15_000,
      });
    });

    test('submit button is visible and enabled after hydration', async ({ page }) => {
      await goToLogin(page);
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible({ timeout: 15_000 });
      await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    });

    test('forgot-password link is visible', async ({ page }) => {
      await goToLogin(page);
      const forgotLink = page.locator('a[href="/forgot-password"]');
      await expect(forgotLink).toBeVisible({ timeout: 15_000 });
    });

    test('page heading says Welcome Back', async ({ page }) => {
      await goToLogin(page);
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  // ── Navigation from forgot-password link ────────────────────────────────

  test.describe('Forgot-password link', () => {
    test('clicking forgot-password navigates to /forgot-password', async ({ page }) => {
      await goToLogin(page);
      const forgotLink = page.locator('a[href="/forgot-password"]');
      await expect(forgotLink).toBeVisible({ timeout: 15_000 });

      // Use click and wait for URL — the link is a Next.js <Link>, which
      // performs a client-side navigation. domcontentloaded is sufficient.
      await Promise.all([
        page.waitForURL(`${BASE_URL}/forgot-password`, {
          waitUntil: 'commit',
          timeout: 30_000,
        }),
        forgotLink.click(),
      ]);

      await expect(page).toHaveURL(/\/forgot-password/, { timeout: 15_000 });
    });
  });

  // ── Invalid credentials ──────────────────────────────────────────────────

  test.describe('Invalid credentials', () => {
    test('wrong password shows error message', async ({ page }) => {
      await goToLogin(page);

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitBtn = page.locator('button[type="submit"]');

      await expect(submitBtn).toBeEnabled({ timeout: 15_000 });

      await emailInput.click();
      await emailInput.fill('nobody@example.invalid');
      await passwordInput.click();
      await passwordInput.fill('WrongPassword999!');
      await submitBtn.click();

      // Firebase returns auth/user-not-found or auth/invalid-credential.
      // The login page maps these to user-visible strings.
      const errorRegion = page.locator('[class*="red"]').filter({
        hasText: /no account|invalid email or password|incorrect password|login failed/i,
      });
      await expect(errorRegion.first()).toBeVisible({ timeout: 15_000 });
    });

    test('empty submission keeps user on login page', async ({ page }) => {
      await goToLogin(page);

      // Both inputs are `required` — native browser validation prevents
      // submission, so the URL must remain /login.
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeEnabled({ timeout: 15_000 });

      // Attempt click with empty fields — browser validation fires
      await submitBtn.click();

      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  });

  // ── Successful login ─────────────────────────────────────────────────────

  test.describe('Successful login', () => {
    test('valid credentials redirect to /dashboard', async ({ page }) => {
      await loginViaUI(page, TEST_USER.email, TEST_USER.password, {
        expectDashboard: true,
      });
      await expectDashboard(page);
    });
  });

  // ── Already-authenticated redirect ───────────────────────────────────────

  test.describe('Already-authenticated redirect', () => {
    test('authenticated session visiting /login is redirected to /dashboard', async ({ page }) => {
      // Log in first, establishing Firebase auth in this browser context.
      await loginViaUI(page, TEST_USER.email, TEST_USER.password, {
        expectDashboard: true,
      });
      await expectDashboard(page);

      // Now visit /login again with the same browser context (still authenticated).
      // The dashboard layout guards unauthenticated users, but the login page
      // itself does not redirect authenticated users server-side. The client-side
      // auth hook triggers router.replace('/dashboard') from the login page guard,
      // so we expect the final URL to land on /dashboard (not stay on /login).
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // The login page shows a loading/redirect state and then pushes to /dashboard.
      // Allow up to 30s for the client-side auth resolution and redirect.
      await page.waitForURL(/\/dashboard/, {
        waitUntil: 'commit',
        timeout: 30_000,
      });

      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
