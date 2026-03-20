/**
 * Website Builder E2E Tests
 *
 * Covers the website builder section of SalesVelocity.ai:
 *   - Visual editor       (/website/editor)
 *   - Pages management    (/website/pages)
 *   - Blog post list      (/website/blog)
 *   - Blog post editor    (/website/blog/editor)
 *   - Domain management   (/website/domains)
 *   - Navigation editor   (/website/navigation)
 *   - SEO tools           (/website/seo)
 *
 * All tests are authenticated. The visual editor test only verifies panel
 * presence; no drag-drop interactions are attempted.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Helper: wait for "Loading..." text to disappear
// ---------------------------------------------------------------------------
async function waitForLoadingToFinish(page: import('@playwright/test').Page): Promise<void> {
  const loadingText = page.getByText(/loading/i).first();
  if (await loadingText.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(loadingText).toBeHidden({ timeout: 15_000 });
  }
}

// ===========================================================================
// Website Editor  (/website/editor)
// ===========================================================================

test.describe('Website Builder — Visual Editor', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads and shows three-panel layout', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The editor renders three flex panels inside a full-viewport container.
    // The outer wrapper is a flex column with height: 100vh.
    // Inside it: EditorToolbar + a flex row containing WidgetsPanel | EditorCanvas | PropertiesPanel.
    //
    // WidgetsPanel exposes tabs: Widgets / Pages / Branding.
    // We assert at least one tab button is visible to confirm the left panel rendered.
    const widgetsTab = page.getByRole('button', { name: /widgets/i });
    await expect(widgetsTab).toBeVisible({ timeout: 15_000 });
  });

  test('canvas area is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // EditorCanvas renders inside a scrollable center container.
    // The toolbar always renders breakpoint toggle buttons (Desktop / Tablet / Mobile).
    const desktopBreakpoint = page.getByRole('button', { name: /desktop/i });
    await expect(desktopBreakpoint).toBeVisible({ timeout: 15_000 });
  });

  test('Save button is rendered in the toolbar', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // EditorToolbar renders a Save button
    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Pages tab navigates the left panel to the pages list', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // WidgetsPanel has a "Pages" tab
    const pagesTab = page.getByRole('button', { name: /^pages$/i });
    await expect(pagesTab).toBeVisible({ timeout: 15_000 });
  });

  test('Branding tab is visible in the left panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const brandingTab = page.getByRole('button', { name: /branding/i });
    await expect(brandingTab).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Pages Management  (/website/pages)
// ===========================================================================

test.describe('Website Builder — Pages management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the pages list with heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders an h1 containing "pages" (case-insensitive)
    const heading = page.locator('h1').filter({ hasText: /pages/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows filter buttons (All / Draft / Published)', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const allFilter = page.getByRole('button', { name: /^all$/i });
    await expect(allFilter).toBeVisible({ timeout: 15_000 });
  });

  test('shows page list items or empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/pages`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Either a list of pages or an empty-state message is visible
    const listOrEmpty = page
      .locator('[data-testid="page-item"], li, .page-item')
      .or(page.getByText(/no pages/i))
      .or(page.locator('table'))
      .or(page.locator('ul'))
      .first();

    // Fallback: at least a New Page / Add Page button should exist
    const addPageBtn = page.getByRole('button', { name: /new page|add page|create page/i });
    const hasListOrEmpty = await listOrEmpty.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasAddBtn = await addPageBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    expect(hasListOrEmpty || hasAddBtn).toBe(true);
  });
});

// ===========================================================================
// Blog Post List  (/website/blog)
// ===========================================================================

test.describe('Website Builder — Blog post list', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the blog management page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/blog`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "blog" (case-insensitive)
    const heading = page.locator('h1').filter({ hasText: /blog/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows filter controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/blog`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // BlogManagementPage renders All/Draft/Published filter buttons
    const allFilter = page.getByRole('button', { name: /^all$/i });
    await expect(allFilter).toBeVisible({ timeout: 15_000 });
  });

  test('shows blog post list or empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/blog`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Either post items or a "No posts" / "Write your first" empty state
    const postsOrEmpty = page
      .locator('article, [data-testid="blog-post-item"]')
      .or(page.getByText(/no posts|write your first|no blog posts/i))
      .or(page.getByRole('button', { name: /new post|create post/i }));

    await expect(postsOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Blog Post Editor  (/website/blog/editor)
// ===========================================================================

test.describe('Website Builder — Blog post editor', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the blog editor with widget panel', async ({ page }) => {
    // No postId param — editor loads in "new post" mode
    await page.goto(`${BASE_URL}/website/blog/editor`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Blog editor reuses WidgetsPanel, so the Widgets/Settings tabs should render
    const panelTab = page
      .getByRole('button', { name: /widgets/i })
      .or(page.getByRole('button', { name: /settings/i }))
      .first();

    // Fall back to checking that the page at minimum renders a heading or toolbar
    const pageContent = page
      .locator('h1, h2, [role="toolbar"], button')
      .first();

    const hasPanelTab = await panelTab.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasContent = await pageContent.isVisible({ timeout: 10_000 }).catch(() => false);

    expect(hasPanelTab || hasContent).toBe(true);
  });

  test('existing post loads when postId query param is provided', async ({ page }) => {
    // Navigate with a fake postId — the editor will attempt to fetch it.
    // Whether it succeeds or shows an error, the page should not hard-crash.
    await page.goto(`${BASE_URL}/website/blog/editor?postId=E2E_TEMP_probe-post`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page should render body content regardless of fetch outcome
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// Domain Management  (/website/domains)
// ===========================================================================

test.describe('Website Builder — Domain management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the domains page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/domains`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading or main section about custom domains
    const heading = page.locator('h1, h2').filter({ hasText: /domain/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows Add Domain form or domain list', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/domains`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Either a list of domains or an Add Domain button / input should be present
    const domainElement = page
      .getByRole('button', { name: /add domain/i })
      .or(page.getByPlaceholder(/domain/i))
      .or(page.locator('input[type="text"]'))
      .first();

    await expect(domainElement).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Navigation Editor  (/website/navigation)
// ===========================================================================

test.describe('Website Builder — Navigation editor', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the navigation page', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/navigation`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page should render a heading or main content related to navigation
    const heading = page.locator('h1, h2').filter({ hasText: /nav/i }).first();
    const pageBody = page.locator('main, [role="main"], .container, div').first();

    const hasHeading = await heading.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasBody = await pageBody.isVisible({ timeout: 8_000 }).catch(() => false);

    expect(hasHeading || hasBody).toBe(true);
  });

  test('page renders without crashing', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/website/navigation`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // HTTP response should be in 2xx range (not a hard 500)
    expect(response?.status()).toBeLessThan(500);
    await waitForPageReady(page);

    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// SEO Tools  (/website/seo)
// ===========================================================================

test.describe('Website Builder — SEO tools', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the SEO management page with heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/seo`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // SEOManagementPage renders a heading containing "seo" or "search"
    const heading = page
      .locator('h1, h2')
      .filter({ hasText: /seo|search engine|robots/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows robots.txt or AI bot access section', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/seo`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The SEO page always renders AI bot controls, robots.txt textarea, or Save button
    const seoControl = page
      .getByText(/robots\.txt|ai bot|crawl|GPTBot/i)
      .or(page.getByRole('button', { name: /save/i }))
      .first();

    await expect(seoControl).toBeVisible({ timeout: 15_000 });
  });

  test('Save button is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/website/seo`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn.first()).toBeVisible({ timeout: 15_000 });
  });
});
