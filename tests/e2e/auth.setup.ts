/**
 * Playwright Auth Setup
 *
 * Logs in as the E2E test user and admin, saves browser storage state
 * so authenticated tests can reuse the session without logging in again.
 *
 * Runs as the `auth-setup` project (see playwright.config.ts).
 *
 * If login fails (accounts not provisioned, dev server not ready, etc.),
 * storage state files are written as empty stubs so dependent tests
 * don't crash on missing files.
 *
 * Provision accounts:  node scripts/seed-e2e-users.mjs
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TEST_USER, TEST_ADMIN, BASE_URL } from './fixtures/test-accounts';

const userAuthFile = path.join(__dirname, '.auth/user.json');
const adminAuthFile = path.join(__dirname, '.auth/admin.json');

const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

function ensureAuthDir(): void {
  const dir = path.dirname(userAuthFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Submit the login form and wait for the dashboard to render.
 *
 * Key insight: the Next.js dev server compiles pages on first visit.
 * We use waitUntil:'load' to ensure JS bundles are loaded before
 * interacting with the form (React hydration must complete first).
 */
async function loginAndWaitForDashboard(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  // Navigate with 'load' to ensure JS bundles are fully loaded.
  // Dev server may compile the page on first visit (can take 10-20s).
  await page.goto(`${BASE_URL}/login`, {
    waitUntil: 'load',
    timeout: 60_000,
  });

  // Wait for React hydration — the submit button must be enabled
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled({ timeout: 15_000 });

  // Fill credentials (click first to ensure focus)
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.click();
  await emailInput.fill(email);
  await passwordInput.click();
  await passwordInput.fill(password);

  // Verify values stuck (React controlled inputs)
  await expect(emailInput).toHaveValue(email, { timeout: 3_000 });

  // Submit the form
  await submitBtn.click();

  // Wait for either: dashboard URL (success) or error text (failure)
  // Firebase auth + Firestore lookup + router.push can take a while on dev server
  const errorLocator = page.getByText('No account found').or(
    page.getByText('Incorrect password')
  ).or(
    page.getByText('Invalid email')
  ).or(
    page.getByText('Invalid email or password')
  );

  // Race: dashboard navigation vs error message
  const result = await Promise.race([
    page.waitForURL('**/dashboard', { timeout: 60_000 })
      .then(() => 'dashboard' as const),
    errorLocator.waitFor({ timeout: 60_000 })
      .then(() => 'error' as const),
  ]);

  if (result === 'error') {
    const errorText = await errorLocator.first().textContent().catch(() => 'Unknown login error');
    throw new Error(`Login failed: ${errorText}`);
  }

  // Wait for dashboard layout to render (sidebar confirms auth resolved)
  await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
}

setup('authenticate as user', async ({ page }) => {
  ensureAuthDir();

  try {
    await loginAndWaitForDashboard(page, TEST_USER.email, TEST_USER.password);
    await page.context().storageState({ path: userAuthFile });
    console.info('[auth.setup] User auth state saved');
  } catch (err) {
    console.warn(`[auth.setup] User login failed — writing empty stub. Error: ${err}`);
    fs.writeFileSync(userAuthFile, EMPTY_STATE);
  }
});

setup('authenticate as admin', async ({ page }) => {
  ensureAuthDir();

  try {
    await loginAndWaitForDashboard(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.context().storageState({ path: adminAuthFile });
    console.info('[auth.setup] Admin auth state saved');
  } catch (err) {
    console.warn(`[auth.setup] Admin login failed — writing empty stub. Error: ${err}`);
    fs.writeFileSync(adminAuthFile, EMPTY_STATE);
  }
});
