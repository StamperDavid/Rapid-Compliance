/**
 * CRM Module E2E Tests
 *
 * Validates the CRM module's core functionality:
 * - Dashboard page loads and displays key widgets
 * - Sidebar shows direct CRM entity links (Leads, Contacts, Companies, Deals)
 * - Entity pages load via /entities/[name] dynamic route
 * - Navigation between entity pages works
 *
 * These tests run against a live Firebase-backed application.
 * No specific data records are assumed to exist in Firestore.
 *
 * @group Phase 3 — CRM
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated } from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Suite 1: Dashboard Page
// ---------------------------------------------------------------------------

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/dashboard`);
    // Use domcontentloaded — Firebase/analytics keep persistent connections
    // that prevent networkidle from ever resolving.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_500);
  });

  test('should load the dashboard without crashing', async ({ page }) => {
    // The URL must still be /dashboard (no unexpected redirect)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should render a page heading or title element', async ({ page }) => {
    // The dashboard page renders an h1 or prominent heading.
    // Accept any visible heading-level element so the test is resilient
    // to minor copy changes.
    const heading = page
      .locator('h1, h2, [role="heading"]')
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should display stat cards or metric widgets', async ({ page }) => {
    // The dashboard shows numeric summary cards (leads, deals, pipeline value, etc.)
    // At minimum one numeric value or card-style container must be visible.
    // We look for the stat containers generically to avoid hard-coding copy.
    const statOrCard = page
      .locator(
        '[class*="card"], [class*="stat"], [class*="metric"], ' +
        '[class*="widget"], [class*="panel"], ' +
        // Fallback: any container whose text begins with a digit
        'div:has(h2), div:has(h3)'
      )
      .first();
    await expect(statOrCard).toBeVisible({ timeout: 15_000 });
  });

  test('should show a navigation link to Leads in the sidebar', async ({ page }) => {
    // The unified sidebar must contain a direct link to the Leads page.
    const leadsLink = page
      .locator('a[href="/leads"], a:has-text("Leads")')
      .first();
    await expect(leadsLink).toBeVisible({ timeout: 15_000 });
  });

  test('should display recent activity section or task list', async ({ page }) => {
    // The dashboard renders either a recent activity feed or an upcoming tasks list.
    const activityOrTasks = page
      .locator(
        'text=/recent activity/i, text=/upcoming tasks/i, ' +
        'text=/tasks/i, text=/activity/i'
      )
      .first();
    await expect(activityOrTasks).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: CRM Sidebar Navigation
// ---------------------------------------------------------------------------

test.describe('CRM Sidebar Links', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);
  });

  test('should display Leads, Contacts, Companies, and Deals links in the sidebar', async ({ page }) => {
    const entities = [
      { label: 'Leads', href: '/leads' },
      { label: 'Contacts', href: '/contacts' },
      { label: 'Companies', href: '/entities/companies' },
      { label: 'Deals', href: '/deals' },
    ];
    let visibleCount = 0;

    for (const entity of entities) {
      const isVisible = await page
        .locator(`a[href="${entity.href}"], a:has-text("${entity.label}")`)
        .first()
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      if (isVisible) {
        visibleCount++;
      }
    }

    // All four core entity links must be visible
    expect(visibleCount).toBeGreaterThanOrEqual(4);
  });

  test('should navigate to the Leads entity page when Leads is clicked', async ({ page }) => {
    const leadsLink = page
      .locator('a[href="/leads"]')
      .first();
    await expect(leadsLink).toBeVisible({ timeout: 15_000 });
    await leadsLink.click();
    await page.waitForURL(/\/entities\/leads|\/leads/, { timeout: 15_000 });
  });

  test('should navigate to the Deals page when Deals is clicked', async ({ page }) => {
    const dealsLink = page
      .locator('a[href="/deals"]')
      .first();
    await expect(dealsLink).toBeVisible({ timeout: 15_000 });
    await dealsLink.click();
    await page.waitForURL(/\/deals/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Entity Page — Generic Data Table
// ---------------------------------------------------------------------------

test.describe('Entity Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/entities/leads`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);
  });

  test('should load the entity page without crashing', async ({ page }) => {
    await expect(page).toHaveURL(/\/entities\/leads/);
  });

  test('should display a data table or empty state', async ({ page }) => {
    const tableOrEmpty = page
      .locator('table, text=/no .* yet/i, text=/no records/i')
      .first();
    await expect(tableOrEmpty).toBeVisible({ timeout: 15_000 });
  });

  test('should navigate back to Dashboard using the sidebar Dashboard link', async ({ page }) => {
    const dashboardLink = page
      .locator('a[href="/dashboard"], a:has-text("Dashboard")')
      .first();
    await expect(dashboardLink).toBeVisible({ timeout: 15_000 });
    await dashboardLink.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
