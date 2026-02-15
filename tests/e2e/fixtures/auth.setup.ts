/**
 * Auth Setup — Runs before all authenticated tests
 *
 * Logs in as the default test user and saves browser storage state
 * so subsequent tests can skip the login flow.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { TEST_USER, TEST_ADMIN, BASE_URL } from './test-accounts';

const userAuthFile = path.join(__dirname, '../.auth/user.json');
const adminAuthFile = path.join(__dirname, '../.auth/admin.json');

setup('authenticate as default user', async ({ page }) => {
  // Navigate to login
  await page.goto(`${BASE_URL}/login`);

  // Fill credentials
  await page.locator('input[type="email"]').fill(TEST_USER.email);
  await page.locator('input[type="password"]').fill(TEST_USER.password);

  // Submit login form
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('h1')).toContainText('Dashboard');

  // Save storage state (cookies + localStorage) for reuse
  await page.context().storageState({ path: userAuthFile });
});

setup('authenticate as admin user', async ({ page }) => {
  // Navigate to admin login
  await page.goto(`${BASE_URL}/admin-login`);

  // Fill credentials
  await page.locator('input[type="email"]').fill(TEST_ADMIN.email);
  await page.locator('input[type="password"]').fill(TEST_ADMIN.password);

  // Submit login form
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 30_000 });

  // Save admin storage state
  await page.context().storageState({ path: adminAuthFile });
});
