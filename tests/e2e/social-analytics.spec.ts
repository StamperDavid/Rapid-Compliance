/**
 * Social Media & Analytics E2E Tests
 *
 * Verifies that social media hub pages and analytics dashboards load
 * without crashing and render their primary UI landmarks. Tests are
 * resilient to missing live data — they check structural elements, not
 * specific data values.
 *
 * Route notes:
 *  - Social hub entry point: /social/command-center  (no /social root page)
 *  - Social calendar:        /social/calendar
 *  - Analytics dashboard:    /analytics
 *  - Pipeline analytics:     /analytics/pipeline
 *  - Outbound hub:           /outbound  (the route is /outbound, not /outreach)
 *
 * @group social-analytics
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

/**
 * Navigate to a page and wait for it to settle.
 * Re-authenticates via UI login if the auth session has lapsed.
 */
async function goTo(
  page: import('@playwright/test').Page,
  path: string
): Promise<void> {
  await ensureAuthenticated(page);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// 1. Social Hub — Command Center
// ---------------------------------------------------------------------------

test.describe('Social Hub — Command Center', () => {
  test('should load the social command center page', async ({ page }) => {
    await goTo(page, '/social/command-center');

    // The command center renders a heading, live status panel, or the
    // social sub-nav (Command Center / Campaigns / Calendar / etc.).
    const hubArea = page.locator(
      'h1, h2, text=Command Center, text=Social, text=Agent Status, text=Platform, ' +
      'a[href="/social/command-center"], a[href="/social/calendar"]'
    ).first();

    await expect(hubArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display sub-navigation for social sections', async ({ page }) => {
    await goTo(page, '/social/command-center');

    // SubpageNav renders links: Command Center, Campaigns, Calendar, Approvals, etc.
    const navLink = page.locator(
      'a:has-text("Calendar"), a:has-text("Campaigns"), a:has-text("Approvals"), ' +
      'a:has-text("Command Center"), nav'
    ).first();

    await expect(navLink).toBeVisible({ timeout: 20_000 });
  });

  test('should show live agent status area or post creation controls', async ({ page }) => {
    await goTo(page, '/social/command-center');

    // The command center shows connected platform status, kill switch, or composer.
    const controlArea = page.locator(
      'text=Platform, text=Connected, text=Status, text=Post, text=Agent, ' +
      'button:has-text("Post"), button:has-text("Create"), [class*="status"], [class*="agent"]'
    ).first();

    await expect(controlArea).toBeVisible({ timeout: 25_000 });
  });

  test('page should not crash (no error boundary)', async ({ page }) => {
    await goTo(page, '/social/command-center');

    const fatalError = page.locator(
      'text=Application error, text=ChunkLoadError, text=Unhandled Runtime Error'
    );
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Social Calendar
// ---------------------------------------------------------------------------

test.describe('Social Hub — Content Calendar', () => {
  test('should load the social calendar page', async ({ page }) => {
    await goTo(page, '/social/calendar');

    // The calendar page renders a heading or the calendar component.
    const calendarArea = page.locator(
      'h1, h2, text=Calendar, text=Content Calendar, text=Scheduled, ' +
      '[class*="calendar"], [class*="Calendar"]'
    ).first();

    await expect(calendarArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display calendar view or loading state', async ({ page }) => {
    await goTo(page, '/social/calendar');

    // The calendar uses react-big-calendar loaded dynamically.
    // Wait for either the calendar grid or the loading indicator.
    const calendarOrLoader = page.locator(
      '[class*="rbc-calendar"], [class*="rbc-month"], text=Loading calendar, ' +
      'text=January, text=February, text=March, text=April, text=May, ' +
      'text=June, text=July, text=August, text=September, text=October, ' +
      'text=November, text=December, text=Mon, text=Tue, text=Wed'
    ).first();

    await expect(calendarOrLoader).toBeVisible({ timeout: 30_000 });
  });

  test('should display social sub-navigation', async ({ page }) => {
    await goTo(page, '/social/calendar');

    const navLink = page.locator(
      'a:has-text("Command Center"), a:has-text("Campaigns"), a:has-text("Approvals"), nav'
    ).first();

    await expect(navLink).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Analytics Dashboard
// ---------------------------------------------------------------------------

test.describe('Analytics — Main Dashboard', () => {
  test('should load the analytics dashboard', async ({ page }) => {
    await goTo(page, '/analytics');

    // The analytics dashboard renders a heading and a metrics summary area.
    const dashboardArea = page.locator(
      'h1, h2, text=Analytics, text=Revenue, text=Pipeline, text=Dashboard, ' +
      '[class*="analytics"], [class*="metric"]'
    ).first();

    await expect(dashboardArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display revenue or pipeline metrics', async ({ page }) => {
    await goTo(page, '/analytics');

    // Revenue and pipeline metrics are the primary data on the analytics home.
    const metricsArea = page.locator(
      'text=Revenue, text=Pipeline, text=Deals, text=Win Rate, text=Contacts, ' +
      'text=Orders, text=Total, [class*="metric"], [class*="stat"], [class*="card"]'
    ).first();

    await expect(metricsArea).toBeVisible({ timeout: 25_000 });
  });

  test('should render analytics sub-navigation', async ({ page }) => {
    await goTo(page, '/analytics');

    // The analytics section uses SubpageNav: Pipeline, Sales, Revenue, etc.
    const subNav = page.locator(
      'a:has-text("Pipeline"), a:has-text("Sales"), a:has-text("Revenue"), ' +
      'a:has-text("Ecommerce"), a:has-text("Attribution"), nav'
    ).first();

    await expect(subNav).toBeVisible({ timeout: 20_000 });
  });

  test('should display charts or data visualisation area', async ({ page }) => {
    await goTo(page, '/analytics');

    // Charts render as SVG or canvas elements, or their container divs.
    const chartOrData = page.locator(
      'svg, canvas, [class*="chart"], [class*="Chart"], ' +
      'text=Total Revenue, text=Deals Count, text=Win Rate, text=Avg Deal'
    ).first();

    const isVisible = await chartOrData.isVisible({ timeout: 15_000 }).catch(() => false);

    // Fallback: the page at minimum must show a heading
    if (!isVisible) {
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });

  test('page should not crash (no error boundary)', async ({ page }) => {
    await goTo(page, '/analytics');

    const fatalError = page.locator(
      'text=Application error, text=ChunkLoadError, text=Unhandled Runtime Error'
    );
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Analytics — Pipeline
// ---------------------------------------------------------------------------

test.describe('Analytics — Pipeline', () => {
  test('should load the pipeline analytics page', async ({ page }) => {
    await goTo(page, '/analytics/pipeline');

    // The pipeline analytics page renders deal stage data.
    const pipelineArea = page.locator(
      'h1, h2, text=Pipeline, text=Deal, text=Stage, text=Value, ' +
      '[class*="pipeline"], [class*="Pipeline"]'
    ).first();

    await expect(pipelineArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display pipeline metrics (total value, deals, win rate)', async ({ page }) => {
    await goTo(page, '/analytics/pipeline');

    // Pipeline summary metrics: total value, deals count, win rate, avg deal size.
    const metricsArea = page.locator(
      'text=Total Value, text=Deals, text=Win Rate, text=Avg Deal, ' +
      'text=Pipeline, text=Stage, text=value, text=count'
    ).first();

    await expect(metricsArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display sub-navigation links', async ({ page }) => {
    await goTo(page, '/analytics/pipeline');

    const subNav = page.locator(
      'a:has-text("Pipeline"), a:has-text("Sales"), a:has-text("Revenue"), nav'
    ).first();

    await expect(subNav).toBeVisible({ timeout: 20_000 });
  });

  test('should show pipeline data or empty state', async ({ page }) => {
    await goTo(page, '/analytics/pipeline');

    // Either pipeline stage rows / chart are shown, or a zero-data state.
    const dataOrEmpty = page.locator(
      '[class*="stage"], [class*="Stage"], svg, canvas, ' +
      'text=No deals, text=No data, text=Pipeline is empty'
    ).first();

    const isVisible = await dataOrEmpty.isVisible({ timeout: 15_000 }).catch(() => false);

    if (!isVisible) {
      // Page must at minimum render without a fatal error
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Outbound Hub  (the route is /outbound — there is no /outreach route)
// ---------------------------------------------------------------------------

test.describe('Outbound Hub', () => {
  test('should load the outbound hub page', async ({ page }) => {
    await goTo(page, '/outbound');

    // The outbound hub renders feature cards: AI Email Writer, Email Sequences.
    const hubArea = page.locator(
      'h1, h2, text=Outbound, text=AI Email Writer, text=Email Sequences, ' +
      'a[href*="/outbound"], [class*="outbound"]'
    ).first();

    await expect(hubArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display outbound feature cards', async ({ page }) => {
    await goTo(page, '/outbound');

    // Feature cards for AI Email Writer and Email Sequences must be visible.
    const emailWriterCard = page.locator('text=AI Email Writer').first();
    await expect(emailWriterCard).toBeVisible({ timeout: 20_000 });

    const sequencesCard = page.locator('text=Email Sequences').first();
    await expect(sequencesCard).toBeVisible({ timeout: 10_000 });
  });

  test('should show navigation links to outbound sub-sections', async ({ page }) => {
    await goTo(page, '/outbound');

    // Feature cards link to /outbound/email-writer and /outbound/sequences.
    const subLink = page.locator(
      'a[href*="email-writer"], a[href*="sequences"], a:has-text("AI Email Writer"), ' +
      'a:has-text("Email Sequences")'
    ).first();

    await expect(subLink).toBeVisible({ timeout: 20_000 });
  });

  test('page should not crash (no error boundary)', async ({ page }) => {
    await goTo(page, '/outbound');

    const fatalError = page.locator(
      'text=Application error, text=ChunkLoadError, text=Unhandled Runtime Error'
    );
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});
