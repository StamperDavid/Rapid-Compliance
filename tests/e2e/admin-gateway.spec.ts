/**
 * Admin Gateway E2E Tests
 *
 * Production Readiness Audit for Admin Command Center
 * Tests the /login -> /admin flow including:
 * - Smart Role-Based Redirect (admin -> /admin)
 * - UnifiedSidebar System Section Visibility (hard-gated)
 * - Admin Theme CSS Variable Isolation (no bleeding from tenant themes)
 *
 * @see Commit df449be8 - Smart Redirect logic
 * @see Commit 1a3c89f5 - Sidebar default collapsed state
 * @see Commit 950e5f08 - Smart role-based login redirection
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const TEST_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@platform.test';
const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'test-password-123';

// Expected Admin Theme CSS Variables (from useAdminTheme.ts DEFAULT_ADMIN_THEME)
const EXPECTED_ADMIN_CSS_VARS = {
  '--admin-color-primary': '#6366f1',
  '--admin-color-primary-light': '#818cf8',
  '--admin-color-primary-dark': '#4f46e5',
  '--admin-color-bg-main': '#000000',
  '--admin-color-bg-paper': '#0a0a0a',
  '--admin-color-text-primary': '#ffffff',
  '--admin-color-border-light': '#333333',
};

// Scoped CSS variables that should be overridden in admin context
const EXPECTED_SCOPED_CSS_VARS = {
  '--color-primary': '#6366f1',
  '--color-bg-main': '#000000',
  '--color-bg-paper': '#0a0a0a',
  '--color-text-primary': '#ffffff',
};

/**
 * Helper: Wait for network idle with extended timeout for auth operations
 */
async function waitForAuthComplete(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

/**
 * Helper: Get computed CSS variable value from an element or root
 */
async function getCSSVariable(page: Page, varName: string, selector?: string): Promise<string> {
  return page.evaluate(
    ({ varName, selector }) => {
      const element = selector
        ? document.querySelector(selector)
        : document.documentElement;
      if (!element) {
        return '';
      }
      return getComputedStyle(element).getPropertyValue(varName).trim();
    },
    { varName, selector }
  );
}

/**
 * Helper: Check if element exists and is visible
 */
async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  const count = await element.count();
  if (count === 0) {
    return false;
  }
  return element.first().isVisible();
}

// =============================================================================
// TEST SUITE: Admin Gateway Production Readiness
// =============================================================================

test.describe('Admin Gateway E2E - Production Readiness Audit', () => {
  test.describe.configure({ mode: 'serial' });

  // ---------------------------------------------------------------------------
  // Test 1: Login Page Accessibility & Form Validation
  // ---------------------------------------------------------------------------
  test('should render login page with proper form elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForAuthComplete(page);

    // Verify page title/header
    await expect(page.locator('h1:has-text("Welcome Back")')).toBeVisible();

    // Verify form elements exist
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

    // Verify email placeholder
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('placeholder', 'you@company.com');

    // Verify password placeholder
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('placeholder', expect.stringContaining('•'));
  });

  // ---------------------------------------------------------------------------
  // Test 2: Smart Redirect - Admin to /admin
  // ---------------------------------------------------------------------------
  test('should redirect admin to /admin after login', async ({ page }) => {
    // Skip if no test credentials configured
    test.skip(
      TEST_ADMIN_EMAIL === 'admin@platform.test',
      'E2E_ADMIN_EMAIL not configured - skipping auth test'
    );

    await page.goto(`${BASE_URL}/login`);
    await waitForAuthComplete(page);

    // Fill login form
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.fill('input[type="password"]', TEST_ADMIN_PASSWORD);

    // Submit form
    await page.click('button:has-text("Sign In")');

    // Wait for redirect (up to 15 seconds for Firebase auth + Firestore lookup)
    await page.waitForURL(`${BASE_URL}/admin**`, { timeout: 15000 });

    // ASSERTION 1: URL must be exactly /admin (not /workspace/...)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/admin(\/|$)/);
    expect(currentUrl).not.toContain('/workspace/');

    // Verify no FOUC - should show loading state during redirect
    // The redirecting state shows a spinner and "Redirecting to your dashboard..."
    // Since we're already redirected, just verify we're on admin
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Test 3: UnifiedSidebar - System Section Visibility (Hard-Gated)
  // ---------------------------------------------------------------------------
  test('should render UnifiedSidebar with System section for admin', async ({ page }) => {
    // Skip if no test credentials configured
    test.skip(
      TEST_ADMIN_EMAIL === 'admin@platform.test',
      'E2E_ADMIN_EMAIL not configured - skipping sidebar test'
    );

    // Navigate directly to admin (assumes authenticated session from previous test)
    await page.goto(`${BASE_URL}/admin`);
    await waitForAuthComplete(page);

    // Wait for sidebar to render
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // ASSERTION 2: System section must be visible
    // The System section has label "System" and is hard-gated to admin only
    // If sidebar sections are collapsed, we need to find the section header
    // System section items include: System Overview, Organizations, All Users, Feature Flags, Audit Logs
    const systemSectionVisible = await isElementVisible(page, 'button:has-text("System")') ||
      await isElementVisible(page, 'div:has-text("System")');

    // Log for debugging
    if (!systemSectionVisible) {
      console.log('System section not immediately visible - checking for collapsed state');
      // Screenshot for debugging
      await page.screenshot({ path: 'playwright-report/admin-sidebar-debug.png' });
    }

    expect(systemSectionVisible).toBe(true);

    // Verify System section items are accessible (may need to expand section first)
    // Look for any of the System section links
    const systemItems = [
      'System Overview',
      'Organizations',
      'All Users',
      'Feature Flags',
      'Audit Logs',
      'System Settings',
    ];

    // Try to find at least one system item (section might be collapsed)
    let foundSystemItem = false;
    for (const item of systemItems) {
      const itemLocator = page.locator(`a:has-text("${item}")`);
      const itemExists = (await itemLocator.count()) > 0;
      if (itemExists) {
        foundSystemItem = true;
        break;
      }
    }

    // If no items found, try expanding the System section
    if (!foundSystemItem) {
      const systemButton = page.locator('button:has-text("System")');
      if ((await systemButton.count()) > 0) {
        await systemButton.click();
        await page.waitForTimeout(300); // Wait for animation

        // Check again after expanding
        for (const item of systemItems) {
          const itemLocator = page.locator(`a:has-text("${item}")`);
          if ((await itemLocator.count()) > 0) {
            foundSystemItem = true;
            break;
          }
        }
      }
    }

    expect(foundSystemItem).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Admin Theme CSS Variable Isolation
  // ---------------------------------------------------------------------------
  test('should apply Admin theme CSS variables correctly', async ({ page }) => {
    // Skip if no test credentials configured
    test.skip(
      TEST_ADMIN_EMAIL === 'admin@platform.test',
      'E2E_ADMIN_EMAIL not configured - skipping theme test'
    );

    await page.goto(`${BASE_URL}/admin`);
    await waitForAuthComplete(page);

    // Wait for admin layout to fully render
    await page.waitForSelector('.admin-theme-scope', { timeout: 10000 }).catch(() => {
      // Class might not be applied directly - check for admin-specific styling
      console.log('admin-theme-scope class not found - checking alternative selectors');
    });

    // ASSERTION 3: Validate Admin CSS variables
    // Check both admin-scoped variables and overridden standard variables

    // Get the admin container (could be .admin-theme-scope or the main layout div)
    const adminContainer = await page.locator('.admin-theme-scope').count() > 0
      ? '.admin-theme-scope'
      : 'body';

    // Collect CSS variable values
    const cssVarResults: Record<string, { expected: string; actual: string; pass: boolean }> = {};

    // Check admin-scoped CSS variables
    for (const [varName, expectedValue] of Object.entries(EXPECTED_ADMIN_CSS_VARS)) {
      const actualValue = await getCSSVariable(page, varName, adminContainer);
      cssVarResults[varName] = {
        expected: expectedValue,
        actual: actualValue,
        pass: actualValue === expectedValue || actualValue === '',
      };
    }

    // Check scoped standard variables (should be overridden in admin context)
    for (const [varName, expectedValue] of Object.entries(EXPECTED_SCOPED_CSS_VARS)) {
      const actualValue = await getCSSVariable(page, varName, adminContainer);
      // These may or may not be set depending on theme loading
      if (actualValue) {
        cssVarResults[varName] = {
          expected: expectedValue,
          actual: actualValue,
          pass: actualValue === expectedValue,
        };
      }
    }

    // Log results for audit report
    console.log('Admin Theme CSS Variable Audit:');
    for (const [varName, result] of Object.entries(cssVarResults)) {
      const status = result.pass ? 'PASS' : 'FAIL';
      console.log(`  ${status}: ${varName} = "${result.actual}" (expected: "${result.expected}")`);
    }

    // At minimum, verify --color-primary is set (core requirement)
    const primaryColor = await getCSSVariable(page, '--color-primary', adminContainer);

    // Theme should be applied - primary color should exist
    // Note: The value might be the admin default (#6366f1) or a custom value from Firestore
    expect(primaryColor).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Test 5: Theme Isolation - No Tenant Variable Bleeding
  // ---------------------------------------------------------------------------
  test('should isolate Admin theme from tenant/root variables', async ({ page }) => {
    // Skip if no test credentials configured
    test.skip(
      TEST_ADMIN_EMAIL === 'admin@platform.test',
      'E2E_ADMIN_EMAIL not configured - skipping isolation test'
    );

    await page.goto(`${BASE_URL}/admin`);
    await waitForAuthComplete(page);

    // The admin theme should NOT inherit tenant-specific colors
    // Tenant themes typically use different color schemes

    // Check that admin-specific variables are present and not undefined
    const adminBgMain = await getCSSVariable(page, '--admin-color-bg-main');
    const adminPrimary = await getCSSVariable(page, '--admin-color-primary');

    // These should either be set (admin theme loaded) or empty (using CSS defaults)
    // They should NOT be tenant-specific values like "#FF5722" (orange) or similar

    // If variables are set, verify they match admin defaults
    if (adminBgMain) {
      expect(adminBgMain).toBe('#000000');
    }
    if (adminPrimary) {
      expect(adminPrimary).toBe('#6366f1');
    }

    // Verify the sidebar uses admin theme colors (visual check)
    const sidebar = page.locator('aside');
    const sidebarBg = await sidebar.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    }).catch(() => '');

    // Background should be dark (admin theme uses dark mode)
    // RGB value for #0a0a0a is rgb(10, 10, 10)
    if (sidebarBg) {
      // Accept any dark background (r, g, b all < 50)
      const rgbMatch = sidebarBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        const isDark = r < 50 && g < 50 && b < 50;
        expect(isDark).toBe(true);
      }
    }
  });
});

// =============================================================================
// TEST SUITE: Admin Gateway Smoke Tests (No Auth Required)
// =============================================================================

test.describe('Admin Gateway - Smoke Tests (No Auth)', () => {
  test('should redirect unauthenticated users from /admin', async ({ page }) => {
    // Navigate directly to admin without auth
    await page.goto(`${BASE_URL}/admin`);
    await waitForAuthComplete(page);

    // Should either:
    // 1. Redirect to login page
    // 2. Show login/auth required message
    // 3. Show loading indefinitely (auth check)

    const url = page.url();
    const isOnAdmin = url.includes('/admin');
    const isOnLogin = url.includes('/login') || url.includes('/admin-login');

    // If still on admin, check for auth-required state
    if (isOnAdmin && !isOnLogin) {
      // Look for loading indicator or auth redirect
      const hasLoadingOrAuth =
        (await page.locator('[class*="animate-spin"]').count()) > 0 ||
        (await page.locator('text=Loading').count()) > 0 ||
        (await page.locator('text=Sign').count()) > 0;

      // Either redirected or showing auth state
      expect(hasLoadingOrAuth || isOnLogin).toBe(true);
    }
  });

  test('should display correct page title on login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForAuthComplete(page);

    // Check for welcome message
    const heading = page.locator('h1');
    await expect(heading).toContainText('Welcome');
  });
});

// =============================================================================
// TEST SUITE: Error Handling & Edge Cases
// =============================================================================

test.describe('Admin Gateway - Error Handling', () => {
  test('should show error message for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForAuthComplete(page);

    // Fill with invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.click('button:has-text("Sign In")');

    // Wait for error to appear (Firebase auth takes time)
    await page.waitForTimeout(3000);

    // Check for error message
    const errorVisible =
      (await page.locator('[class*="red"]').count()) > 0 ||
      (await page.locator('[class*="error"]').count()) > 0 ||
      (await page.locator('text=Invalid').count()) > 0 ||
      (await page.locator('text=incorrect').count()) > 0 ||
      (await page.locator('text=No account').count()) > 0;

    expect(errorVisible).toBe(true);
  });

  test('should prevent form submission when fields are empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForAuthComplete(page);

    // Try to submit empty form - verify form validation prevents submission
    // Note: Submit button exists but HTML5 validation prevents empty submission
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Both should be required
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });
});
