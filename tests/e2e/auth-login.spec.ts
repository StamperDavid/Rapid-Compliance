/**
 * Auth Login E2E Tests
 *
 * Validates the complete login flow:
 * - Valid credentials → redirect to dashboard
 * - Invalid credentials → error messages
 * - Form validation states
 * - Loading/submitting indicators
 *
 * @group Phase 2A — Authentication
 */

import { test, expect } from '@playwright/test';
import { TEST_USER, TEST_ADMIN, BASE_URL } from './fixtures/test-accounts';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('should display login form with all required elements', async ({ page }) => {
    // Verify form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify helper links
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
    await expect(page.locator('a[href="/onboarding/industry"]')).toBeVisible();

    // Verify placeholders
    await expect(page.locator('input[type="email"]')).toHaveAttribute(
      'placeholder',
      'you@company.com'
    );
  });

  test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
    // Fill in credentials
    await page.locator('input[type="email"]').fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill(TEST_USER.password);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should show loading state
    await expect(page.locator('button[type="submit"]')).toContainText(/Signing in/i);

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

    // Verify dashboard loaded
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(
      page.locator('text=Welcome back')
    ).toBeVisible();
  });

  test('should show error for invalid email', async ({ page }) => {
    await page.locator('input[type="email"]').fill('nonexistent@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Wait for error message (Firebase returns user-not-found or invalid-credential)
    const errorContainer = page.locator('.bg-red-900\\/30, [role="alert"]');
    await expect(errorContainer).toBeVisible({ timeout: 10_000 });
  });

  test('should show error for wrong password', async ({ page }) => {
    await page.locator('input[type="email"]').fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill('CompletelyWrongPassword!');
    await page.locator('button[type="submit"]').click();

    // Wait for error message
    const errorContainer = page.locator('.bg-red-900\\/30, [role="alert"]');
    await expect(errorContainer).toBeVisible({ timeout: 10_000 });
  });

  test('should prevent submission with empty fields', async ({ page }) => {
    // Try to submit without filling anything
    await page.locator('button[type="submit"]').click();

    // Should stay on login page (HTML5 validation prevents submission)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to signup from login page', async ({ page }) => {
    await page.locator('a[href="/onboarding/industry"]').click();
    await page.waitForURL('**/onboarding/industry');
    await expect(page).toHaveURL(/\/onboarding\/industry/);
  });

  test('should navigate to forgot password from login page', async ({ page }) => {
    await page.locator('a[href="/forgot-password"]').click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Admin Login Flow', () => {
  test('should login via admin login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin-login`);

    // Verify admin login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill admin credentials
    await page.locator('input[type="email"]').fill(TEST_ADMIN.email);
    await page.locator('input[type="password"]').fill(TEST_ADMIN.password);
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
  });

  test('should show admin-specific warning text', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin-login`);

    // Admin login page should contain a warning about admin access
    await expect(
      page.locator('text=admin account')
    ).toBeVisible();
  });
});

test.describe('Login Redirect Behavior', () => {
  test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // Try to access dashboard directly
    await page.goto(`${BASE_URL}/dashboard`);

    // Should redirect to login
    await page.waitForURL(/\/(login|admin-login)/, { timeout: 15_000 });
  });
});
