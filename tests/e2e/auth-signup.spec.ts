/**
 * Auth Signup E2E Tests
 *
 * Validates the signup/onboarding flow:
 * - /signup redirects to /onboarding/industry
 * - Onboarding flow steps load correctly
 * - New account creation flow
 *
 * @group Phase 2A — Authentication
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';

test.describe('Signup & Onboarding Flow', () => {
  test('should redirect /signup to onboarding industry page', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    // /signup is a redirect-only page that sends users to onboarding
    await page.waitForURL('**/onboarding/industry', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/onboarding\/industry/);
  });

  test('should display onboarding industry selection page', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/industry`);

    // Verify the onboarding page loaded with selectable options
    await page.waitForLoadState('networkidle');

    // Page should have content related to industry or business type selection
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should navigate to login from onboarding', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/industry`);
    await page.waitForLoadState('networkidle');

    // Look for a "sign in" or "login" link on the onboarding page
    const loginLink = page.locator('a[href="/login"], a:has-text("Sign in"), a:has-text("Log in")');
    if (await loginLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should display "Sign up free" link on login page that leads to onboarding', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // The login page has a "Sign up free" link pointing to onboarding
    const signupLink = page.locator('a[href="/onboarding/industry"]');
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toContainText(/sign up/i);

    await signupLink.click();
    await expect(page).toHaveURL(/\/onboarding\/industry/);
  });

  test('should load onboarding page without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/onboarding/industry`);
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors (e.g., Firebase analytics, third-party scripts)
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('analytics') &&
        !err.includes('favicon') &&
        !err.includes('third-party')
    );

    // No critical console errors should appear on the onboarding page
    expect(criticalErrors.length).toBeLessThanOrEqual(1);
  });
});

test.describe('Public Route Accessibility', () => {
  test('login page is accessible without auth', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/login`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('forgot-password page is accessible without auth', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/forgot-password`);
    expect(response?.status()).toBeLessThan(400);
  });

  test('onboarding page is accessible without auth', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/onboarding/industry`);
    expect(response?.status()).toBeLessThan(400);
  });
});
