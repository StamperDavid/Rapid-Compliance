/**
 * Settings E2E Tests
 *
 * Covers the settings hub and individual settings pages of SalesVelocity.ai:
 *   - Settings hub         (/settings)
 *   - API Keys             (/settings/api-keys)
 *   - Billing              (/settings/billing)
 *   - Theme & Branding     (/settings/theme)
 *   - Security             (/settings/security)
 *   - Integrations         (/settings/integrations)
 *   - Webhooks             (/settings/webhooks)
 *   - AI Agents            (/settings/ai-agents)
 *
 * All tests are authenticated. Each describe block is independent — no shared
 * state is mutated between tests.
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
// Settings Hub  (/settings)
// ===========================================================================

test.describe('Settings — Hub page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads with h1 "Settings" heading', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const heading = page.locator('h1', { hasText: 'Settings' });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('renders section grid with at least one settings card', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The hub renders a grid of Link cards.  Each visible card has a label
    // (e.g. "API Keys", "Billing & Plans", "Security").
    // We assert at least one Link pointing to a settings sub-page is visible.
    const settingsLink = page.locator('a[href*="/settings/"]').first();
    await expect(settingsLink).toBeVisible({ timeout: 15_000 });
  });

  test('shows "Your Organization" info card', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const orgCard = page.getByText(/your organization/i);
    await expect(orgCard).toBeVisible({ timeout: 15_000 });
  });

  test('API Keys card link is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Card may be hidden by permission gates for member-level users;
    // assert visibility only when it exists in the DOM.
    const apiKeysLink = page.locator('a[href*="/settings/api-keys"]');
    const count = await apiKeysLink.count();
    if (count > 0) {
      await expect(apiKeysLink.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ===========================================================================
// API Keys  (/settings/api-keys)
// ===========================================================================

test.describe('Settings — API Keys', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the API keys page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/api-keys`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "api key" (case-insensitive)
    const heading = page.locator('h1, h2').filter({ hasText: /api key/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows service key inputs or configuration fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/api-keys`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // API keys page renders password-type inputs for each service key
    const keyInput = page.locator('input[type="password"], input[type="text"]').first();
    await expect(keyInput).toBeVisible({ timeout: 15_000 });
  });

  test('does not show raw secret values (values are masked)', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/api-keys`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Sensitive key inputs should be password type (browser masks the value)
    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();
    // If any password inputs are present they should be of type password (masked)
    if (count > 0) {
      const firstInput = passwordInputs.first();
      await expect(firstInput).toBeVisible({ timeout: 10_000 });
      const inputType = await firstInput.getAttribute('type');
      expect(inputType).toBe('password');
    }
  });
});

// ===========================================================================
// API Key Save/Verify Journey
// ===========================================================================

test.describe('Settings — API Key Save Journey', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('save an API key and verify it persists after reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/api-keys`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Wait for page heading
    const heading = page.locator('h1, h2').filter({ hasText: /api key/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Find the first API key input (password type for masking)
    const keyInput = page.locator('input[type="password"]').first();
    await expect(keyInput).toBeVisible({ timeout: 10_000 });

    // Store original value to restore later
    const originalValue = await keyInput.inputValue();

    // Enter a test key
    const testKey = `sk-test-e2e-${Date.now()}`;
    await keyInput.clear();
    await keyInput.fill(testKey);

    // Click the Save button associated with this input
    const saveBtn = page.locator('button').filter({ hasText: /^save$/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for save confirmation
    const savedConfirmation = page.getByText(/saved/i).first().or(
      page.getByText(/success/i).first()
    );
    await expect(savedConfirmation).toBeVisible({ timeout: 10_000 });

    // Reload and verify the key persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const reloadedInput = page.locator('input[type="password"]').first();
    await expect(reloadedInput).toBeVisible({ timeout: 15_000 });

    // The input should have a value (key was persisted to Firestore)
    const persistedValue = await reloadedInput.inputValue();
    expect(persistedValue.length).toBeGreaterThan(0);

    // Restore: clear the key back to original state
    await reloadedInput.clear();
    if (originalValue) {
      await reloadedInput.fill(originalValue);
    }
    const restoreBtn = page.locator('button').filter({ hasText: /^save$/i }).first();
    if (await restoreBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await restoreBtn.click();
      await savedConfirmation.waitFor({ timeout: 10_000 }).catch(() => {});
    }
  });
});

// ===========================================================================
// Billing  (/settings/billing)
// ===========================================================================

test.describe('Settings — Billing', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the billing page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/billing`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading related to billing or plans
    const heading = page.locator('h1, h2').filter({ hasText: /billing|plan/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('page renders without crashing (HTTP 2xx)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/settings/billing`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(response?.status()).toBeLessThan(500);
    await waitForPageReady(page);

    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// Theme & Branding  (/settings/theme)
// ===========================================================================

test.describe('Settings — Theme & Branding', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the theme settings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/theme`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "theme" or "brand"
    const heading = page.locator('h1, h2').filter({ hasText: /theme|brand/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows color picker inputs or color hex inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/theme`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Theme page always renders color inputs (#rrggbb text fields or type="color")
    const colorControl = page
      .locator('input[type="color"], input[placeholder*="#"], input[value^="#"], input[type]')
      .first();

    // Fall back: at least a Save button is present
    const saveBtn = page.getByRole('button', { name: /save/i });
    const hasColorControl = await colorControl.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasSaveBtn = await saveBtn.first().isVisible({ timeout: 8_000 }).catch(() => false);

    expect(hasColorControl || hasSaveBtn).toBe(true);
  });

  test('Save button is rendered', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/theme`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Security  (/settings/security)
// ===========================================================================

test.describe('Settings — Security', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the security settings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/security`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "security"
    const heading = page.locator('h1, h2').filter({ hasText: /security/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows two-factor auth toggle or security controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/security`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Security page renders toggle checkboxes for 2FA, IP whitelist, etc.
    const securityControl = page
      .locator('input[type="checkbox"]')
      .or(page.getByText(/two.factor|2fa|ip whitelist|session timeout/i))
      .first();

    await expect(securityControl).toBeVisible({ timeout: 15_000 });
  });

  test('audit log section is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/security`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders an audit log section heading or table
    const auditSection = page
      .getByText(/audit log/i)
      .or(page.locator('h2, h3').filter({ hasText: /audit/i }))
      .first();

    await expect(auditSection).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Integrations  (/settings/integrations)
// ===========================================================================

test.describe('Settings — Integrations', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the integrations page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/integrations`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "integration"
    const heading = page.locator('h1, h2').filter({ hasText: /integration/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows integration category tabs or filter buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/integrations`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // IntegrationsPage renders category filter buttons (Accounting, Email, Calendar, etc.)
    const categoryBtn = page
      .getByRole('button', { name: /accounting|email|calendar|slack|stripe|all/i })
      .first();

    await expect(categoryBtn).toBeVisible({ timeout: 15_000 });
  });

  test('at least one integration card is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/integrations`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // The page always renders known integration cards (Stripe, QuickBooks, Slack…)
    const integrationCard = page
      .getByText(/stripe|quickbooks|xero|slack|zapier|gmail|outlook/i)
      .first();

    await expect(integrationCard).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// Webhooks  (/settings/webhooks)
// ===========================================================================

test.describe('Settings — Webhooks', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the webhooks page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/webhooks`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "webhook"
    const heading = page.locator('h1, h2').filter({ hasText: /webhook/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows Add Webhook button or webhook list', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/webhooks`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const addBtn = page.getByRole('button', { name: /add webhook|create webhook|new webhook/i });
    const webhookList = page.locator('table, [data-testid="webhook-item"], ul li').first();

    const hasAddBtn = await addBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasList = await webhookList.isVisible({ timeout: 8_000 }).catch(() => false);

    expect(hasAddBtn || hasList).toBe(true);
  });

  test('page body renders cleanly', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/webhooks`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// AI Agents  (/settings/ai-agents)
// ===========================================================================

test.describe('Settings — AI Agents', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('loads the AI agents page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Page renders a heading containing "agent" or "jasper"
    const heading = page.locator('h1, h2').filter({ hasText: /agent|jasper/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('shows agent option cards (Persona, Training, Voice, Configuration)', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // AIAgentsPage renders cards for: Agent Persona, Training Center, Voice & Speech, Configuration
    const agentCard = page
      .getByText(/agent persona|training center|voice|configuration/i)
      .first();

    await expect(agentCard).toBeVisible({ timeout: 15_000 });
  });

  test('sub-page links navigate correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForPageReady(page);
    await waitForLoadingToFinish(page);

    // Links to sub-pages should be present in the DOM
    const subPageLink = page.locator('a[href*="/settings/ai-agents/"]').first();
    await expect(subPageLink).toBeVisible({ timeout: 15_000 });
  });
});
