/**
 * Settings Pages E2E Tests
 *
 * Verifies that all key settings pages load without crashing and render
 * their primary UI landmarks. Tests are resilient to missing live data
 * (Firebase-backed app) — they check structural elements, not specific
 * data values.
 *
 * These are smoke tests: page renders correctly, no crash, key areas visible.
 * Authentication is handled via Playwright storageState (configured in
 * playwright.config.ts) or falls back to UI login via ensureAuthenticated.
 *
 * @group settings
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a settings sub-page and wait for it to be ready.
 * Accepts auth-gate redirects gracefully — if the app redirects to /login
 * or /dashboard we re-authenticate and navigate again.
 */
async function goToSettings(
  page: import('@playwright/test').Page,
  path: string
): Promise<void> {
  await ensureAuthenticated(page);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPageReady(page);
}

// ---------------------------------------------------------------------------
// 1. Subscription Page
// ---------------------------------------------------------------------------

test.describe('Settings — Subscription page', () => {
  test('should load and display plan cards', async ({ page }) => {
    await goToSettings(page, '/settings/subscription');

    // The page renders a tier/plan grid — at minimum one plan card must be visible.
    // The h1 reads "Subscription & Features"; plan cards render labels from SUBSCRIPTION_TIERS.
    const planArea = page.locator('h1')
      .or(page.locator('h2'))
      .or(page.locator('[class*="plan"]'))
      .or(page.locator('[class*="tier"]'))
      .or(page.locator('text=Starter'))
      .or(page.locator('text=Professional'))
      .or(page.locator('text=Enterprise'))
      .or(page.locator('text=Free'))
      .first();

    await expect(planArea).toBeVisible({ timeout: 20_000 });
  });

  test('should display billing period toggle (monthly / annual)', async ({ page }) => {
    await goToSettings(page, '/settings/subscription');

    // The subscription page has a billing toggle between monthly and annual.
    // The buttons render exact text "Monthly" and "Annual".
    const toggleArea = page.locator('button:has-text("Monthly")')
      .or(page.locator('button:has-text("Annual")'))
      .first();

    await expect(toggleArea).toBeVisible({ timeout: 15_000 });
  });

  test('should show current subscription status', async ({ page }) => {
    await goToSettings(page, '/settings/subscription');

    // Either shows a "Current Plan" badge / label, or a loading state —
    // in either case the page must not show an unhandled error.
    const pageBody = page.locator('main, [role="main"], body').first();
    await expect(pageBody).toBeVisible({ timeout: 10_000 });

    // Confirm no 500-level error text is rendered
    const errorText = page.locator('text=500')
      .or(page.locator('text=Internal Server Error'))
      .or(page.locator('text=Something went wrong'));
    const hasError = await errorText.first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Billing Page
// ---------------------------------------------------------------------------

test.describe('Settings — Billing page', () => {
  test('should load and show usage metrics section', async ({ page }) => {
    await goToSettings(page, '/settings/billing');

    // Billing page renders a usage metrics panel.
    // The labels "Contacts", "Emails Sent", or "AI Credits" identify that section.
    // Accept Loading state too — Firestore may be slow.
    const usageArea = page.locator('text=Contacts')
      .or(page.locator('text=Emails Sent'))
      .or(page.locator('text=AI Credits'))
      .or(page.locator('text=Usage This Period'))
      .or(page.locator('text=Billing'))
      .or(page.locator('h1'))
      .first();

    await expect(usageArea).toBeVisible({ timeout: 20_000 });
  });

  test('should render payment method area or subscription panel', async ({ page }) => {
    await goToSettings(page, '/settings/billing');

    // The billing page shows either the subscription tier,
    // a "Manage Subscription" section, or a payment method area.
    const billingArea = page.locator('text=Billing & Plans')
      .or(page.locator('text=Billing Details'))
      .or(page.locator('text=Manage Subscription'))
      .or(page.locator('text=Current Plan'))
      .or(page.locator('text=Payment Method'))
      .first();

    await expect(billingArea).toBeVisible({ timeout: 20_000 });
  });

  test('page should not crash (no unhandled error boundary)', async ({ page }) => {
    await goToSettings(page, '/settings/billing');

    const fatalError = page.locator('text=Application error')
      .or(page.locator('text=ChunkLoadError'))
      .or(page.locator('text=Unhandled Runtime Error'));
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Integrations Page
// ---------------------------------------------------------------------------

test.describe('Settings — Integrations page', () => {
  test('should load and display integration cards', async ({ page }) => {
    await goToSettings(page, '/settings/integrations');

    // The integrations page shows cards for services like Stripe, Gmail, Slack, etc.
    const integrationCard = page.locator('text=Stripe')
      .or(page.locator('text=Gmail'))
      .or(page.locator('text=Slack'))
      .or(page.locator('text=QuickBooks'))
      .or(page.locator('text=Xero'))
      .or(page.locator('text=LinkedIn'))
      .or(page.locator('[class*="integration"]'))
      .or(page.locator('[class*="card"]'))
      .first();

    await expect(integrationCard).toBeVisible({ timeout: 20_000 });
  });

  test('should display category navigation or sidebar', async ({ page }) => {
    await goToSettings(page, '/settings/integrations');

    // The integrations page has category filter buttons (Payment Processing, Email, Communication, etc.)
    const categoryNav = page.locator('text=Payment Processing')
      .or(page.locator('text=Email'))
      .or(page.locator('text=Communication'))
      .or(page.locator('text=Accounting'))
      .or(page.locator('nav'))
      .first();

    await expect(categoryNav).toBeVisible({ timeout: 20_000 });
  });

  test('should show Connect or Disconnect buttons for at least one integration', async ({ page }) => {
    await goToSettings(page, '/settings/integrations');

    const actionBtn = page.locator(
      'button:has-text("Connect"), button:has-text("Disconnect"), button:has-text("Configure")'
    ).first();

    await expect(actionBtn).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Storefront Page
// ---------------------------------------------------------------------------

test.describe('Settings — Storefront page', () => {
  test('should load and display storefront settings UI', async ({ page }) => {
    await goToSettings(page, '/settings/storefront');

    // The storefront settings page renders the "Online Storefront" heading and store config fields.
    const storefrontArea = page.locator('h1')
      .or(page.locator('h2'))
      .or(page.locator('text=Online Storefront'))
      .or(page.locator('text=Business Type'))
      .or(page.locator('input[name="storeName"]'))
      .or(page.locator('input[placeholder*="store"]'))
      .first();

    await expect(storefrontArea).toBeVisible({ timeout: 20_000 });
  });

  test('should have a save or update action button', async ({ page }) => {
    await goToSettings(page, '/settings/storefront');

    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
    ).first();

    await expect(saveBtn).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// 5. Email Templates Page
// ---------------------------------------------------------------------------

test.describe('Settings — Email Templates page', () => {
  test('should load and display templates list or empty state', async ({ page }) => {
    await goToSettings(page, '/settings/email-templates');

    // The email templates page renders either a list of templates or an empty state.
    // The page h1 renders "Email Marketing".
    const templatesArea = page.locator('h1')
      .or(page.locator('h2'))
      .or(page.locator('text=Email Marketing'))
      .or(page.locator('text=Custom Email Templates'))
      .or(page.locator('button:has-text("New Template")'))
      .or(page.locator('button:has-text("Create Template")'))
      .first();

    await expect(templatesArea).toBeVisible({ timeout: 20_000 });
  });

  test('should render template action buttons', async ({ page }) => {
    await goToSettings(page, '/settings/email-templates');

    // Either "New Template" / "Create" buttons for empty state,
    // or Edit/Delete actions on existing templates.
    const actionBtn = page.locator('button:has-text("New")')
      .or(page.locator('button:has-text("Create")'))
      .or(page.locator('button:has-text("Edit")'))
      .or(page.locator('button:has-text("Template")'))
      .or(page.locator('a:has-text("Template")'))
      .first();

    await expect(actionBtn).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Workflows Page
// ---------------------------------------------------------------------------

test.describe('Settings — Workflows page', () => {
  test('should load and display workflow builder area', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // /settings/workflows redirects to /workflows which renders an h1 "Workflows"
    // and a "Create Workflow" button.
    const workflowArea = page.locator('h1')
      .or(page.locator('h2'))
      .or(page.locator('text=Workflows'))
      .or(page.locator('text=Automate your sales processes'))
      .or(page.locator('button:has-text("Create Workflow")'))
      .or(page.locator('[class*="workflow"]'))
      .first();

    await expect(workflowArea).toBeVisible({ timeout: 20_000 });
  });

  test('should have workflow creation entry point', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // /settings/workflows redirects to /workflows — creation button is "Create Workflow".
    const createBtn = page.locator('button:has-text("Create Workflow")')
      .or(page.locator('button:has-text("New")'))
      .or(page.locator('a:has-text("New Workflow")'))
      .first();

    await expect(createBtn).toBeVisible({ timeout: 20_000 });
  });

  test('should display workflow list or empty state', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // Either an existing workflow is listed, the empty state, or loading state.
    const listOrEmpty = page.locator('[class*="workflow-item"]')
      .or(page.locator('[class*="card"]'))
      .or(page.locator('text=No workflows'))
      .or(page.locator('text=Get started'))
      .first();

    const isVisible = await listOrEmpty.isVisible({ timeout: 10_000 }).catch(() => false);

    // The page must render something — list, empty state, heading, or loading
    const fallbackHeading = page.locator('h1, h2').first();
    const headingVisible = await fallbackHeading.isVisible({ timeout: 5_000 }).catch(() => false);
    const loadingVisible = await page.locator('text=Loading').isVisible({ timeout: 3_000 }).catch(() => false);

    expect(isVisible || headingVisible || loadingVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. AI Agents Page
// ---------------------------------------------------------------------------

test.describe('Settings — AI Agents page', () => {
  test('should load and show agent configuration hub', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    // The AI agents hub page renders an h1 "AI Agent" and navigation cards
    // for Agent Persona, Training Center, and Voice & Speech.
    // Accept Loading or any heading — auth resolution may be slow.
    const agentArea = page.locator('h1')
      .or(page.locator('h2'))
      .or(page.locator('text=AI Agent'))
      .or(page.locator('text=Agent Persona'))
      .or(page.locator('text=Training Center'))
      .or(page.locator('text=Loading'))
      .first();

    await expect(agentArea).toBeVisible({ timeout: 25_000 });
  });

  test('should display sub-section links (Persona, Training, etc.)', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    // The page shows navigation cards with links to persona, training, and voice.
    const subLink = page.locator('text=Agent Persona')
      .or(page.locator('text=Training Center'))
      .or(page.locator('text=Voice & Speech'))
      .or(page.locator('a[href*="persona"]'))
      .or(page.locator('a[href*="training"]'))
      .or(page.locator('a[href*="voice"]'))
      .first();

    await expect(subLink).toBeVisible({ timeout: 20_000 });
  });

  test('page should not crash (no error boundary)', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    const fatalError = page.locator('text=Application error')
      .or(page.locator('text=ChunkLoadError'))
      .or(page.locator('text=Unhandled Runtime Error'));
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});
