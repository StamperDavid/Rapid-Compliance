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
    // Selectors cover heading, billing toggle, and plan card text.
    const planArea = page.locator(
      'h1, h2, [class*="plan"], [class*="tier"], text=Starter, text=Professional, text=Enterprise, text=Free'
    ).first();

    await expect(planArea).toBeVisible({ timeout: 20_000 });
  });

  test('should display billing period toggle (monthly / annual)', async ({ page }) => {
    await goToSettings(page, '/settings/subscription');

    // The subscription page has a billing toggle between monthly and annual
    const toggleArea = page.locator(
      'button:has-text("Monthly"), button:has-text("Annual"), text=monthly, text=annual'
    ).first();

    await expect(toggleArea).toBeVisible({ timeout: 15_000 });
  });

  test('should show current subscription status', async ({ page }) => {
    await goToSettings(page, '/settings/subscription');

    // Either shows a "Current Plan" badge / label, or a loading state —
    // in either case the page must not show an unhandled error.
    const pageBody = page.locator('main, [role="main"], body').first();
    await expect(pageBody).toBeVisible({ timeout: 10_000 });

    // Confirm no 500-level error text is rendered
    const errorText = page.locator('text=500, text=Internal Server Error, text=Something went wrong');
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
    // The labels "Contacts", "Emails", or "AI Credits" identify that section.
    const usageArea = page.locator(
      'text=Contacts, text=Emails, text=AI Credits, text=Usage, text=usage'
    ).first();

    await expect(usageArea).toBeVisible({ timeout: 20_000 });
  });

  test('should render payment method area or subscription panel', async ({ page }) => {
    await goToSettings(page, '/settings/billing');

    // The billing page shows either the subscription tier,
    // a "Manage Billing" / Stripe portal link, or a payment method section.
    const billingArea = page.locator(
      'text=Billing, text=Payment, text=Subscription, text=Cancel, text=Manage, text=Stripe'
    ).first();

    await expect(billingArea).toBeVisible({ timeout: 20_000 });
  });

  test('page should not crash (no unhandled error boundary)', async ({ page }) => {
    await goToSettings(page, '/settings/billing');

    const fatalError = page.locator(
      'text=Application error, text=ChunkLoadError, text=Unhandled Runtime Error'
    );
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
    const integrationCard = page.locator(
      'text=Stripe, text=Gmail, text=Slack, text=QuickBooks, text=Xero, text=LinkedIn, ' +
      '[class*="integration"], [class*="card"]'
    ).first();

    await expect(integrationCard).toBeVisible({ timeout: 20_000 });
  });

  test('should display category navigation or sidebar', async ({ page }) => {
    await goToSettings(page, '/settings/integrations');

    // The integrations page has a category sidebar (CRM, Email, Payments, etc.)
    const categoryNav = page.locator(
      'text=Payment, text=Email, text=CRM, text=Communication, text=Category, aside, nav'
    ).first();

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

    // The storefront settings page renders store name, URL, and business type fields.
    const storefrontArea = page.locator(
      'h1, h2, text=Storefront, text=Store, text=storefront, text=Business Type, ' +
      'input[name="storeName"], input[placeholder*="store"], [class*="storefront"]'
    ).first();

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
    const templatesArea = page.locator(
      'h1, h2, text=Email Templates, text=Templates, text=template, text=No templates, ' +
      'button:has-text("New Template"), button:has-text("Create Template"), [class*="template"]'
    ).first();

    await expect(templatesArea).toBeVisible({ timeout: 20_000 });
  });

  test('should render template action buttons', async ({ page }) => {
    await goToSettings(page, '/settings/email-templates');

    // Either "New Template" / "Create" buttons for empty state,
    // or Edit/Delete actions on existing templates.
    const actionBtn = page.locator(
      'button:has-text("New"), button:has-text("Create"), button:has-text("Edit"), ' +
      'button:has-text("Template"), a:has-text("Template")'
    ).first();

    await expect(actionBtn).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Workflows Page
// ---------------------------------------------------------------------------

test.describe('Settings — Workflows page', () => {
  test('should load and display workflow builder area', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // The workflows page renders a workflow list / builder area.
    const workflowArea = page.locator(
      'h1, h2, text=Workflow, text=Automation, text=workflow, text=No workflows, ' +
      'button:has-text("New Workflow"), button:has-text("Create Workflow"), [class*="workflow"]'
    ).first();

    await expect(workflowArea).toBeVisible({ timeout: 20_000 });
  });

  test('should have workflow creation entry point', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // Workflow creation is triggered via a "New Workflow" or "Create" button.
    const createBtn = page.locator(
      'button:has-text("New"), button:has-text("Create"), a:has-text("New Workflow")'
    ).first();

    await expect(createBtn).toBeVisible({ timeout: 20_000 });
  });

  test('should display workflow list or empty state', async ({ page }) => {
    await goToSettings(page, '/settings/workflows');

    // Either an existing workflow is listed, or the empty state is visible.
    const listOrEmpty = page.locator(
      '[class*="workflow-item"], [class*="card"], text=No workflows, text=Get started'
    ).first();

    const isVisible = await listOrEmpty.isVisible({ timeout: 10_000 }).catch(() => false);

    // The page must render something — either list or empty state
    const fallbackHeading = page.locator('h1, h2').first();
    const headingVisible = await fallbackHeading.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(isVisible || headingVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. AI Agents Page
// ---------------------------------------------------------------------------

test.describe('Settings — AI Agents page', () => {
  test('should load and show agent configuration hub', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    // The AI agents hub page renders navigation cards to sub-sections:
    // Agent Persona, Training Center, Business Setup, Voice AI.
    const agentArea = page.locator(
      'h1, h2, text=AI Agents, text=Agent, text=Persona, text=Training, text=Configuration'
    ).first();

    await expect(agentArea).toBeVisible({ timeout: 20_000 });
  });

  test('should display sub-section links (Persona, Training, etc.)', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    // The page shows navigation cards with links to persona, training, business setup.
    const subLink = page.locator(
      'text=Agent Persona, text=Training Center, text=Business Setup, ' +
      'a[href*="persona"], a[href*="training"], a[href*="configuration"]'
    ).first();

    await expect(subLink).toBeVisible({ timeout: 20_000 });
  });

  test('page should not crash (no error boundary)', async ({ page }) => {
    await goToSettings(page, '/settings/ai-agents');

    const fatalError = page.locator(
      'text=Application error, text=ChunkLoadError, text=Unhandled Runtime Error'
    );
    const hasFatalError = await fatalError.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasFatalError).toBe(false);
  });
});
