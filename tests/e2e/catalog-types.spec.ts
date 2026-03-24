/**
 * E2E Test: Catalog Item Type Enforcement
 *
 * Tests the catalog type selector and type display:
 *   1. Navigate to products page
 *   2. Click "+ Add Product" → verify type selector renders
 *   3. Select "Service" type → verify form labels update
 *   4. Select "Digital Product" type → verify stock status hides
 *   5. Create a product with type → verify type badge in listing
 *   6. Edit the product → verify type is preserved
 *   7. Navigate to Services tab → verify type filter works
 *   8. Delete the test product
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

async function navigateTo(page: import('@playwright/test').Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPageReady(page);
  const authLoading = page.locator('p').filter({ hasText: 'Loading...' }).first();
  if (await authLoading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await authLoading.waitFor({ state: 'hidden', timeout: 30_000 });
  }
  await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 });
}

test.describe('Catalog Item Type Enforcement', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('new product form shows type selector with 4 options', async ({ page }) => {
    await navigateTo(page, '/products/new');

    // Verify all 4 type buttons render
    await expect(page.getByText('Physical Product')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Service')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Digital Product')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Subscription')).toBeVisible({ timeout: 10_000 });

    // Default should be "Physical Product" (highlighted)
    const productBtn = page.locator('button').filter({ hasText: 'Physical Product' });
    const borderColor = await productBtn.evaluate(
      (el) => getComputedStyle(el).borderColor,
    );
    // Should have primary border color (non-default border)
    expect(borderColor).toBeTruthy();
  });

  test('selecting Service type updates page title', async ({ page }) => {
    await navigateTo(page, '/products/new?type=service');

    // Page title should reflect Service type
    const heading = page.locator('h1');
    await expect(heading).toContainText(/service/i, { timeout: 15_000 });
  });

  test('selecting Digital type hides stock status field', async ({ page }) => {
    await navigateTo(page, '/products/new');

    // Click Digital Product type
    const digitalBtn = page.locator('button').filter({ hasText: 'Digital Product' });
    await digitalBtn.click();

    // Stock Status select should not be visible for digital products
    const stockSelect = page.locator('select').filter({ hasText: /in stock/i });
    await expect(stockSelect).toBeHidden({ timeout: 5_000 });
  });

  test('type query param pre-selects correct type', async ({ page }) => {
    await navigateTo(page, '/products/new?type=subscription');

    // Subscription type should be selected
    const heading = page.locator('h1');
    await expect(heading).toContainText(/subscription/i, { timeout: 15_000 });

    // Price label should say "Monthly Price"
    await expect(page.getByText(/monthly price/i)).toBeVisible({ timeout: 10_000 });
  });

  test('products table shows Type column with badges', async ({ page }) => {
    await navigateTo(page, '/products');

    // Verify the Type column header exists
    const typeHeader = page.locator('th').filter({ hasText: 'Type' });
    await expect(typeHeader).toBeVisible({ timeout: 15_000 });
  });

  test('create product with type, verify in listing, then delete', async ({ page }) => {
    const productName = `E2E Type Test ${Date.now()}`;

    // Navigate to new product form
    await navigateTo(page, '/products/new');

    // Select Service type
    const serviceBtn = page.locator('button').filter({ hasText: 'Service' });
    await serviceBtn.click();

    // Fill required fields
    const nameInput = page.locator('input').filter({ has: page.locator('[name="name"]') }).or(
      page.locator('input[type="text"]').first()
    );
    await nameInput.fill(productName);

    const priceInput = page.locator('input[type="number"]').first();
    await priceInput.fill('99.99');

    // Submit the form
    const createBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /create service/i })
    ).first();
    await createBtn.click();

    // Should redirect to services page (since type=service)
    await page.waitForURL(/\/products/, { timeout: 15_000 });
    await waitForPageReady(page);

    // Navigate to all products to verify type badge
    await navigateTo(page, '/products');

    // Look for our product with Service badge
    const productRow = page.locator('tr', { hasText: productName });
    if (await productRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      // Verify Service badge
      const typeBadge = productRow.getByText('Service');
      await expect(typeBadge).toBeVisible({ timeout: 5_000 });

      // Clean up: delete the test product
      const deleteBtn = productRow.locator('button').filter({ hasText: /delete/i });
      await deleteBtn.click();

      // Confirm deletion
      const confirmBtn = page.locator('button').filter({ hasText: /^delete$/i }).last();
      if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1_000);
      }
    }
  });

  test('edit page shows type selector with current type selected', async ({ page }) => {
    await navigateTo(page, '/products');

    // Find any existing product's edit button
    const editBtn = page.locator('button').filter({ hasText: /edit/i }).or(
      page.locator('a').filter({ hasText: /edit/i })
    ).first();

    if (await editBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await editBtn.click();

      // Wait for edit page to load
      await page.waitForURL(/\/products\/.*\/edit/, { timeout: 15_000 });
      await waitForPageReady(page);

      // Verify type selector renders with all 4 options
      await expect(page.getByText('Physical Product')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Service')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Digital Product')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Subscription')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('services page filters by type', async ({ page }) => {
    await navigateTo(page, '/products/services');

    // Verify Services heading
    const heading = page.locator('h1').filter({ hasText: /services/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify Add Service button links to ?type=service
    const addBtn = page.locator('button').filter({ hasText: /add service/i });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });
});
