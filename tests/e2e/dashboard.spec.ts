/**
 * Dashboard E2E Spec
 *
 * Tests the main dashboard at /dashboard.
 * All tests run in the `chromium` project with stored auth state.
 * `ensureAuthenticated` acts as a fallback in case storage state did not
 * restore the Firebase session.
 *
 * Selectors are derived from the real AdminSidebar and dashboard/page.tsx
 * source. No UI-created test data — all assertions target demo/production data
 * or structural elements that are always present for an authenticated user.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the dashboard and wait for the loading spinner to clear.
 * The layout shows "Loading..." while Firebase auth resolves; we must wait
 * for that to disappear before asserting page content.
 */
async function goToDashboard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await waitForPageReady(page);

  // Wait for auth loading screen to disappear
  const loadingText = page.locator('text=Loading...').first();
  const sidebar = page.locator('aside');
  // Either the sidebar renders quickly or we wait for loading to vanish
  await Promise.race([
    sidebar.waitFor({ state: 'visible', timeout: 30_000 }),
    loadingText.waitFor({ state: 'hidden', timeout: 30_000 }).then(() =>
      sidebar.waitFor({ state: 'visible', timeout: 15_000 })
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dashboard page', () => {
  test('dashboard page loads and displays h1 heading', async ({ page }) => {
    await goToDashboard(page);

    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('sidebar is visible on the dashboard', async ({ page }) => {
    await goToDashboard(page);

    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  });

  test('sidebar displays the SalesVelocity.ai branding', async ({ page }) => {
    await goToDashboard(page);

    // The sidebar header renders "SalesVelocity.ai" and "Command Center"
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=SalesVelocity.ai').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('sidebar contains all 9 navigation section labels', async ({ page }) => {
    await goToDashboard(page);

    const sidebar = page.locator('aside');

    // Section headers are rendered as buttons with uppercase text. The exact
    // labels come from NAV_SECTIONS in AdminSidebar.tsx.
    const expectedSections = [
      'Home',
      'CRM',
      'Outreach',
      'Marketing',
      'Commerce',
      'Website',
      'AI Workforce',
      'Analytics & Growth',
      'System',
    ];

    for (const section of expectedSections) {
      // Use a case-insensitive text match inside the aside — section labels
      // are rendered in uppercase CSS but the text node itself is normal case.
      await expect(
        sidebar.locator(`button`, { hasText: section }).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('sidebar Home section contains Dashboard and Team links', async ({ page }) => {
    await goToDashboard(page);

    const sidebar = page.locator('aside');

    // Dashboard link is always visible because its section is active on /dashboard
    await expect(sidebar.locator('a[href="/dashboard"]')).toBeVisible({
      timeout: 15_000,
    });

    // Team link — may need to expand the Home section if it collapsed
    const homeSection = sidebar.locator('button', { hasText: 'Home' }).first();
    const isExpanded = await homeSection.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await homeSection.click();
    }
    await expect(sidebar.locator('a[href="/team/leaderboard"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('sidebar footer contains Integrations, Settings, and Help links', async ({ page }) => {
    await goToDashboard(page);

    const sidebar = page.locator('aside');
    await expect(sidebar.locator('a[href="/settings/integrations"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.locator('a[href="/settings"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.locator('a[href="/academy"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('dashboard displays KPI stat cards', async ({ page }) => {
    await goToDashboard(page);

    // KPI cards are rendered as Link elements. Each has an uppercase label
    // span. We look for the label text that is always present regardless of
    // whether data has loaded.
    const kpiLabels = ['Pipeline', 'Active Deals', 'Leads', 'Win Rate', 'Conversations'];

    for (const label of kpiLabels) {
      await expect(
        page.locator(`text=${label}`).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('dashboard displays Recent Activity section', async ({ page }) => {
    await goToDashboard(page);

    // The SectionHeader for the activity feed renders "Recent Activity"
    await expect(
      page.locator('h2', { hasText: 'Recent Activity' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard displays Sales Pipeline section', async ({ page }) => {
    await goToDashboard(page);

    await expect(
      page.locator('h2', { hasText: 'Sales Pipeline' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard displays AI Workforce section', async ({ page }) => {
    await goToDashboard(page);

    await expect(
      page.locator('h2', { hasText: 'AI Workforce' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Jasper AI assistant widget is present in the DOM', async ({ page }) => {
    await goToDashboard(page);

    // MerchantOrchestrator renders a floating button. OrchestratorBase uses
    // MessageSquare icon and the ASSISTANT_NAME constant ("Jasper"). The
    // widget is a fixed-position element rendered outside the main content.
    // We look for the aria-label or a button that mentions Jasper / the chat
    // toggle. If the widget has not yet loaded, it renders nothing until auth
    // is resolved, so we use a generous timeout.
    const orchestratorButton = page
      .locator('button[aria-label*="Jasper"], button[aria-label*="Chat"], button[title*="Jasper"]')
      .or(page.locator('[data-testid="orchestrator-toggle"]'))
      .or(
        // Fallback: any fixed/floating button outside aside and main that
        // contains "Jasper" text (rendered after auth resolves)
        page.locator('button').filter({ hasText: /jasper/i })
      )
      .first();

    // The orchestrator is client-rendered; give it time to mount.
    await expect(orchestratorButton).toBeVisible({ timeout: 20_000 });
  });

  test('clicking CRM section link navigates to the CRM area', async ({ page }) => {
    await goToDashboard(page);

    const sidebar = page.locator('aside');

    // Expand CRM section if collapsed
    const crmHeader = sidebar.locator('button', { hasText: 'CRM' }).first();
    const isExpanded = await crmHeader.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await crmHeader.click();
    }

    // Click the Leads link
    const leadsLink = sidebar.locator('a[href="/leads"]').first();
    await expect(leadsLink).toBeVisible({ timeout: 10_000 });
    await leadsLink.click();

    // /leads redirects to /entities/leads
    await page.waitForURL(/\/(leads|entities\/leads)/, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/\/(leads|entities\/leads)/);
  });

  test('clicking Analytics & Growth section link navigates to analytics', async ({ page }) => {
    await goToDashboard(page);

    const sidebar = page.locator('aside');

    // Expand the Analytics section if collapsed
    const analyticsHeader = sidebar
      .locator('button', { hasText: 'Analytics & Growth' })
      .first();
    const isExpanded = await analyticsHeader.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await analyticsHeader.click();
    }

    const overviewLink = sidebar.locator('a[href="/analytics"]').first();
    await expect(overviewLink).toBeVisible({ timeout: 10_000 });
    await overviewLink.click();

    await page.waitForURL(/\/analytics/, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/\/analytics/);
  });

  test('clicking Deals pipeline card link navigates to /deals', async ({ page }) => {
    await goToDashboard(page);

    // The KPI "Active Deals" card is a Link to /deals
    const dealsLink = page.locator('a[href="/deals"]').first();
    await expect(dealsLink).toBeVisible({ timeout: 15_000 });
    await dealsLink.click();

    await page.waitForURL(/\/deals/, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/\/deals/);
  });
});
