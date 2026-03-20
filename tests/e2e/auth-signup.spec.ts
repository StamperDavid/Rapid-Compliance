/**
 * E2E Tests: Signup / Onboarding Flow
 *
 * Project: no-auth (no stored auth state — runs clean browser context)
 *
 * Covers:
 *  - /signup client-side redirect lands on /onboarding/industry
 *  - Industry selection page renders its core UI elements
 *  - The industry category combobox opens and allows selection
 *  - Account creation step (/onboarding/account) has required form fields
 *
 * Data safety: these tests do NOT submit the account-creation form, so no
 * Firebase Auth users or Firestore documents are created. No afterEach
 * cleanup is required.
 *
 * Design notes:
 *  - /signup is a client-side redirect (router.replace) — no HTTP 3xx.
 *    We navigate to /signup and wait for the browser URL to settle on
 *    /onboarding/industry.
 *  - The industry selection page uses a combobox (not discrete cards).
 *    The dropdown renders inside an AnimatePresence block; we wait for
 *    the trigger button before interacting.
 *  - /onboarding/account requires selectedCategory in Zustand store.
 *    Because tests are isolated browser contexts, the store will be empty
 *    and the page immediately redirects to /onboarding/industry. We test
 *    the account step fields by navigating to /onboarding/industry first,
 *    selecting a category, then following the flow.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { waitForPageReady } from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToPage(
  page: import('@playwright/test').Page,
  path: string,
): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Signup / Onboarding Flow', () => {
  // ── /signup redirect ─────────────────────────────────────────────────────

  test.describe('/signup redirect', () => {
    test('/signup redirects to /onboarding/industry', async ({ page }) => {
      await goToPage(page, '/signup');

      // router.replace is client-side — wait for the URL to settle.
      await page.waitForURL(`${BASE_URL}/onboarding/industry`, {
        waitUntil: 'commit',
        timeout: 30_000,
      });

      await expect(page).toHaveURL(/\/onboarding\/industry/);
    });
  });

  // ── Industry selection page ──────────────────────────────────────────────

  test.describe('Industry selection page (/onboarding/industry)', () => {
    test.beforeEach(async ({ page }) => {
      await goToPage(page, '/onboarding/industry');
    });

    test('page heading is visible', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /tell us about you/i }),
      ).toBeVisible({ timeout: 15_000 });
    });

    test('full name input is visible', async ({ page }) => {
      // Full Name uses type="text" with placeholder "John Smith"
      const nameInput = page.locator('input[type="text"]').filter({
        has: page.locator('[placeholder="John Smith"]'),
      });
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
    });

    test('business email input is visible', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible({
        timeout: 15_000,
      });
    });

    test('industry category combobox trigger is visible', async ({ page }) => {
      const trigger = page.getByText('Select your industry...');
      await expect(trigger).toBeVisible({ timeout: 15_000 });
    });

    test('opening industry combobox shows search and category options', async ({ page }) => {
      // Click the combobox trigger button
      const comboboxTrigger = page.locator('button').filter({
        hasText: /select your industry/i,
      });
      await expect(comboboxTrigger).toBeVisible({ timeout: 15_000 });
      await comboboxTrigger.click();

      // The AnimatePresence dropdown should render a search input
      const searchInput = page.locator('input[placeholder="Search categories..."]');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });

      // At least one category option should be present
      const firstOption = page
        .locator('[class*="max-h"] button')
        .first();
      await expect(firstOption).toBeVisible({ timeout: 10_000 });
    });

    test('selecting an industry shows its name in the combobox trigger', async ({ page }) => {
      const comboboxTrigger = page.locator('button').filter({
        hasText: /select your industry/i,
      });
      await expect(comboboxTrigger).toBeVisible({ timeout: 15_000 });
      await comboboxTrigger.click();

      // Wait for dropdown to open
      const searchInput = page.locator('input[placeholder="Search categories..."]');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });

      // Pick the first available category
      const firstOption = page
        .locator('[class*="max-h"] button')
        .first();
      await expect(firstOption).toBeVisible({ timeout: 10_000 });
      const selectedName = (await firstOption.locator('div').first().textContent())?.trim() ?? '';
      await firstOption.click();

      // Dropdown should close and the trigger should now display the chosen name
      await expect(searchInput).toBeHidden({ timeout: 5_000 });
      await expect(
        page.locator('button').filter({ hasText: selectedName }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('Continue button is disabled when required fields are empty', async ({ page }) => {
      // No inputs filled — form is invalid, button should be disabled
      const continueBtn = page.locator('button').filter({ hasText: /^continue/i });
      await expect(continueBtn).toBeVisible({ timeout: 15_000 });
      await expect(continueBtn).toBeDisabled({ timeout: 5_000 });
    });

    test('sign in link navigates to /login', async ({ page }) => {
      const signInLink = page.locator('a[href="/login"]');
      await expect(signInLink).toBeVisible({ timeout: 15_000 });

      await Promise.all([
        page.waitForURL(`${BASE_URL}/login`, {
          waitUntil: 'commit',
          timeout: 30_000,
        }),
        signInLink.click(),
      ]);

      await expect(page).toHaveURL(/\/login/);
    });
  });

  // ── Account creation step ────────────────────────────────────────────────

  test.describe('Account creation step (/onboarding/account)', () => {
    /**
     * Pre-condition: populate the Zustand onboarding store so that
     * /onboarding/account does not immediately redirect back to /onboarding/industry.
     *
     * Strategy: navigate to /onboarding/industry, fill required fields (name +
     * email + select a category that routes directly to /onboarding/account),
     * then click Continue.
     *
     * Zustand persists to sessionStorage by default in the onboarding store, so
     * state survives the Next.js client navigation within the same browser context.
     */
    async function reachAccountStep(
      page: import('@playwright/test').Page,
    ): Promise<void> {
      await goToPage(page, '/onboarding/industry');

      // Fill name
      const nameInput = page.locator('input[placeholder="John Smith"]');
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
      await nameInput.click();
      await nameInput.fill('E2E Test User');

      // Fill email
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();
      await emailInput.fill('e2e-temp@salesvelocity.ai');

      // Open category combobox and pick first option
      const comboboxTrigger = page.locator('button').filter({
        hasText: /select your industry/i,
      });
      await comboboxTrigger.click();

      const firstOption = page
        .locator('[class*="max-h"] button')
        .first();
      await expect(firstOption).toBeVisible({ timeout: 10_000 });
      await firstOption.click();

      // Wait for dropdown to close
      await expect(
        page.locator('input[placeholder="Search categories..."]'),
      ).toBeHidden({ timeout: 5_000 });

      // Click Continue — the route decision depends on the selected category.
      // Some categories go to /onboarding/niche, others straight to /onboarding/account.
      // We click and wait for either destination, then follow the chain if needed.
      const continueBtn = page.locator('button').filter({ hasText: /^continue/i });
      await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
      await continueBtn.click();

      // Wait for the next onboarding step (niche or account)
      await page.waitForURL(/\/onboarding\/(niche|account)/, {
        waitUntil: 'commit',
        timeout: 30_000,
      });

      // If we landed on /niche, we need to select a niche and continue
      if (page.url().includes('/onboarding/niche')) {
        // Pick the first niche option available
        const nicheOption = page.locator('button[type="button"]').first();
        await expect(nicheOption).toBeVisible({ timeout: 15_000 });
        await nicheOption.click();

        const nicheContinue = page.locator('button').filter({ hasText: /^continue/i });
        await expect(nicheContinue).toBeEnabled({ timeout: 10_000 });
        await nicheContinue.click();

        await page.waitForURL(/\/onboarding\/account/, {
          waitUntil: 'commit',
          timeout: 30_000,
        });
      }
    }

    test('account step has company name input', async ({ page }) => {
      await reachAccountStep(page);
      const companyInput = page.locator('input[placeholder="Acme Inc."]');
      await expect(companyInput).toBeVisible({ timeout: 15_000 });
    });

    test('account step has email address input', async ({ page }) => {
      await reachAccountStep(page);
      await expect(page.locator('input[type="email"]')).toBeVisible({
        timeout: 15_000,
      });
    });

    test('account step has password input', async ({ page }) => {
      await reachAccountStep(page);
      // There are two password fields (password + confirmPassword)
      const passwordInputs = page.locator('input[type="password"]');
      await expect(passwordInputs.first()).toBeVisible({ timeout: 15_000 });
    });

    test('account step has create account submit button', async ({ page }) => {
      await reachAccountStep(page);
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible({ timeout: 15_000 });
      await expect(submitBtn).toContainText(/create account/i);
    });
  });
});
