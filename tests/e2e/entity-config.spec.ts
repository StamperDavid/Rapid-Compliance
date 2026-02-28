/**
 * Entity Config E2E Tests
 *
 * Verifies the CRM entity configurability system:
 *   1. /api/entity-config GET requires auth (401)
 *   2. /api/entity-config PUT requires auth (401)
 *   3. Settings > Features page has the "CRM Entities" tab (requires auth)
 *   4. CRM Entities tab renders Always-On, CRM Extended, and Industry sections (requires auth)
 *   5. Entity page renders (requires auth)
 *   6. Schema Editor page renders (requires auth)
 *
 * Tests 1-2 run without auth. Tests 3-6 require authenticated storage state
 * (provisioned via auth.setup.ts) and are skipped if auth state is empty.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';

async function goTo(page: import('@playwright/test').Page, path: string): Promise<void> {
  await ensureAuthenticated(page);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// API Auth Gating (no auth required to test — these verify 401 responses)
// ---------------------------------------------------------------------------
test('GET /api/entity-config returns 401 without auth', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/entity-config`);
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
});

test('PUT /api/entity-config returns 401 without auth', async ({ request }) => {
  const res = await request.put(`${BASE_URL}/api/entity-config`, {
    data: { entities: { invoices: false } },
  });
  expect(res.status()).toBe(401);
});

// ---------------------------------------------------------------------------
// Authenticated Page Tests (require E2E accounts provisioned in Firebase)
// ---------------------------------------------------------------------------
test('Settings > Features page has CRM Entities tab', async ({ page }) => {
  await goTo(page, '/settings/features');
  const crmEntitiesTab = page.getByRole('tab', { name: /CRM Entities/i });
  await expect(crmEntitiesTab).toBeVisible({ timeout: 15_000 });
});

test('CRM Entities tab shows Always On, CRM Extended, and Industry-Specific sections', async ({ page }) => {
  await goTo(page, '/settings/features');

  const crmEntitiesTab = page.getByRole('tab', { name: /CRM Entities/i });
  await crmEntitiesTab.click();

  await expect(page.getByText('Always On')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('CRM Extended')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Industry-Specific')).toBeVisible({ timeout: 5_000 });
});

test('Entity page /entities/invoices loads without crashing', async ({ page }) => {
  await goTo(page, '/entities/invoices');
  const heading = page.locator('h1');
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const text = await heading.textContent();
  expect(text?.toLowerCase()).toContain('invoice');
});

test('Schema Editor page loads and shows schema cards', async ({ page }) => {
  await goTo(page, '/schemas');
  await expect(page.getByText('Schema Editor')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lead')).toBeVisible({ timeout: 10_000 });
});
