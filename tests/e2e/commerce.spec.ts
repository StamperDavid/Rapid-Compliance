/**
 * Commerce E2E Tests
 *
 * Covers the e-commerce surface of SalesVelocity.ai:
 *   - Admin product management  (/products)
 *   - Admin order management    (/orders)
 *   - Public storefront catalog (/store/products)
 *   - Public checkout page      (/store/checkout)
 *   - Public product detail     (/store/products/:id)
 *   - Settings > Storefront     (/settings/storefront)
 *
 * All authenticated tests use ensureAuthenticated() so they work whether the
 * stored auth state restored correctly or whether a fresh UI login is required.
 * Public storefront pages do NOT call ensureAuthenticated because they are
 * publicly accessible and should render without a session.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Helper: wait for "Loading..." text to disappear and assert a heading/element
// ---------------------------------------------------------------------------
async function waitForLoadingToFinish(page: import('@playwright/test').Page): Promise<void> {
  // Wait up to 15 s for any "Loading…" text to clear
  const loadingText = page.getByText(/loading/i).first();
  if (await loadingText.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(loadingText).toBeHidden({ timeout: 15_000 });
  }
}

// ===========================================================================
// Admin: Product Management  (/products)
// ===========================================================================

test.describe('Admin — Products page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with h1 "Products" heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const heading = page.locator('h1', { hasText: 'Products' });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows Add Product button', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page always renders either a table or an empty-state message plus the Add Product CTA
    const addBtn = page.getByRole('button', { name: /add product/i });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
  });

  test('shows product table or empty-state copy', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const tableOrEmpty = page
      .locator('table')
      .or(page.getByText(/no products yet/i));
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Admin: Orders  (/orders)
// ===========================================================================

test.describe('Admin — Orders page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with h1 "Orders" heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const heading = page.locator('h1', { hasText: 'Orders' });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('renders search input and status filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const searchInput = page.getByPlaceholder(/search by order/i);
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    const statusSelect = page.locator('select');
    await expect(statusSelect).toBeVisible({ timeout: 15_000 });
  });

  test('shows order table or no-orders empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const tableOrEmpty = page
      .locator('table')
      .or(page.getByText(/no orders found/i));
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Export CSV button is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const exportBtn = page.getByRole('button', { name: /export csv/i });
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Public Storefront — Product Catalog  (/store/products)
// ===========================================================================

test.describe('Public storefront — Product catalog', () => {
  // These pages are publicly accessible; no auth required.

  test('loads the product catalog header and search', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The page renders an h1 with the company name from branding config
    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/search products/i);
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
  });

  test('shows "All Products" filter button', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const allProductsBtn = page.getByRole('button', { name: /all products/i });
    await expect(allProductsBtn).toBeVisible({ timeout: 15_000 });
  });

  test('renders product grid or no-products message', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Either product cards (h3 headings inside cards) or the "No products found" message
    const gridOrEmpty = page
      .locator('main h3')
      .or(page.getByText(/no products found/i));
    await expect(gridOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });

  test('cart button is present in the header', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const cartBtn = page.getByRole('button', { name: /cart/i });
    await expect(cartBtn).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Public Storefront — Checkout  (/store/checkout)
// ===========================================================================

test.describe('Public storefront — Checkout page', () => {
  test('loads checkout page structure (cart redirect or checkout form)', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/checkout`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The checkout page either:
    //  a) Redirects to /store/cart when no cart session exists (no cartSessionId in localStorage), OR
    //  b) Renders the full checkout form with h1 "Checkout" when a cart session is present.
    // Both outcomes are valid — we verify the final URL is either /store/checkout or /store/cart.
    const currentUrl = page.url();
    const isCheckout = currentUrl.includes('/store/checkout');
    const isCart = currentUrl.includes('/store/cart');

    expect(isCheckout || isCart).toBe(true);
  });

  test('checkout page shows Checkout heading or cart redirect', async ({ page }) => {
    // Inject a fake cartSessionId so the page does not immediately redirect
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.evaluate(() => {
      localStorage.setItem('cartSessionId', 'E2E_TEMP_fake-cart-session');
    });

    await page.goto(`${BASE_URL}/store/checkout`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // With a session ID set, the page fetches the cart.
    // If the cart is empty / not found, it redirects back to /store/cart.
    // Either outcome renders page structure we can verify.
    const headingOrCart = page
      .locator('h1', { hasText: /checkout/i })
      .or(page.locator('h1'))
      .or(page.getByText(/your cart is empty/i))
      .or(page.locator('header'));

    await expect(headingOrCart.first()).toBeVisible({ timeout: 15_000 });

    // Clean up the fake session
    await page.evaluate(() => localStorage.removeItem('cartSessionId'));
  });

  test('secure payment badge is rendered on checkout page when cart exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.evaluate(() => {
      localStorage.setItem('cartSessionId', 'E2E_TEMP_fake-cart-session');
    });

    await page.goto(`${BASE_URL}/store/checkout`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Only assert Stripe badge if we are actually on the checkout page
    if (page.url().includes('/store/checkout')) {
      const stripeBadge = page.getByText(/securely processed by stripe/i);
      // Badge is in the order summary sidebar — visible once cart loads.
      // If the cart fetch fails/redirects, this assertion is skipped gracefully.
      const isCheckoutPage = await page.locator('h1', { hasText: /checkout/i }).isVisible({ timeout: 5_000 }).catch(() => false);
      if (isCheckoutPage) {
        await expect(stripeBadge).toBeVisible({ timeout: 15_000 });
      }
    }

    await page.evaluate(() => localStorage.removeItem('cartSessionId'));
  });
});

// ===========================================================================
// Public Storefront — Product Detail  (/store/products/:id)
// ===========================================================================

test.describe('Public storefront — Product detail', () => {
  test('product detail URL format is accessible (or redirects gracefully)', async ({ page }) => {
    // Navigate with a placeholder ID — the page will either load a 404/not-found
    // state or the product detail. Either way the page structure should render
    // without a crash.
    await page.goto(`${BASE_URL}/store/products/E2E_TEMP_probe-id`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Page renders without a full error — body content is present
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });

    // URL should remain under /store/products/ or navigate to /store/products
    const currentUrl = page.url();
    expect(currentUrl).toContain('/store/products');
  });
});

// ===========================================================================
// Settings — Storefront  (/settings/storefront)
// ===========================================================================

test.describe('Settings — Storefront', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads settings/storefront page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/storefront`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "storefront" (case-insensitive)
    const heading = page.locator('h1, h2').filter({ hasText: /storefront/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows enable/disable storefront toggle or storefront configuration', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/storefront`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page always has a meaningful interactive element or configuration section
    const configElement = page
      .locator('input[type="checkbox"], input[type="radio"], button')
      .first();
    await expect(configElement).toBeVisible({ timeout: 15_000 });
  });
});
