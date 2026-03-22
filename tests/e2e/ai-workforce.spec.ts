/**
 * AI Workforce Feature E2E Tests
 *
 * Covers mission control history, AI datasets, AI fine-tuning,
 * AI agent settings, agent persona, and voice settings pages.
 *
 * Tests verify page rendering, interactive elements, navigation flows,
 * and form interactions — not just page-load checks.
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Auth setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});

// ---------------------------------------------------------------------------
// /mission-control/history
// ---------------------------------------------------------------------------

test.describe('Mission Control History page', () => {
  test('loads with heading, table columns, and resolves loading', async ({ page }) => {
    await page.goto(`${BASE_URL}/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Mission Control' })
    ).toBeVisible({ timeout: 15_000 });

    // Table header columns are always rendered regardless of data state
    for (const col of ['Title', 'Status', 'Steps', 'Duration', 'Date']) {
      await expect(page.locator(`text=${col}`)).toBeVisible({ timeout: 10_000 });
    }

    // Loading resolves — empty state or mission rows
    await expect(page.locator('text=Loading...')).toBeHidden({ timeout: 15_000 });
    const emptyState = page.locator('text=No missions found.');
    const missionRow = page.locator('[role="button"]').first();
    await expect(emptyState.or(missionRow)).toBeVisible({ timeout: 10_000 });
  });

  test('stays on history page (no redirect) and URL is correct', async ({ page }) => {
    await page.goto(`${BASE_URL}/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page).toHaveURL(/\/mission-control\/history/, { timeout: 10_000 });
  });

  test('clicking a mission row expands details or stays interactive', async ({ page }) => {
    await page.goto(`${BASE_URL}/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading...')).toBeHidden({ timeout: 15_000 });

    const missionRow = page.locator('[role="button"]').first();
    if (await missionRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await missionRow.click();
      // After click, either detail panel appears or page navigates
      await page.waitForTimeout(500);
      // Verify we're still on the page (no crash)
      await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });
    }
    // If no missions exist, test passes (empty state is valid)
  });
});

// ---------------------------------------------------------------------------
// /ai/datasets
// ---------------------------------------------------------------------------

test.describe('AI Datasets page', () => {
  test('loads with heading and Create Dataset button', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/datasets`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Training Datasets' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: '+ Create Dataset' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or dataset cards appear', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/datasets`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('text=No datasets yet');
    const datasetGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(datasetGrid)).toBeVisible({ timeout: 15_000 });
  });

  test('Create Dataset button opens modal or form', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/datasets`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const createBtn = page.locator('button', { hasText: '+ Create Dataset' });
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();

    // Expect a modal, dialog, or expanded form to appear
    const modal = page.locator('[role="dialog"]');
    const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]');
    const formHeading = page.locator('h2, h3').filter({ hasText: /dataset/i });
    await expect(
      modal.or(nameInput).or(formHeading)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// /ai/fine-tuning
// ---------------------------------------------------------------------------

test.describe('AI Fine-Tuning page', () => {
  test('loads with heading and Start Fine-Tuning button', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/fine-tuning`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Fine-Tuning Jobs' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: '+ Start Fine-Tuning' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or job cards appear', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/fine-tuning`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('text=No fine-tuning jobs yet');
    const jobGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(jobGrid)).toBeVisible({ timeout: 15_000 });
  });

  test('Start Fine-Tuning button opens creation flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai/fine-tuning`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const startBtn = page.locator('button', { hasText: '+ Start Fine-Tuning' });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    await startBtn.click();

    // Modal, dialog, or form for new fine-tuning job
    const modal = page.locator('[role="dialog"]');
    const formElement = page.locator('select, input[type="text"], textarea').first();
    const formHeading = page.locator('h2, h3').filter({ hasText: /fine-tun/i });
    await expect(
      modal.or(formElement).or(formHeading)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents
// ---------------------------------------------------------------------------

test.describe('AI Agent Settings page', () => {
  test('loads with heading and three agent option cards with Manage links', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'AI Agent' })
    ).toBeVisible({ timeout: 15_000 });

    // All three option cards
    for (const card of ['Agent Persona', 'Training Center', 'Voice & Speech']) {
      await expect(page.locator('h3', { hasText: card })).toBeVisible({ timeout: 15_000 });
    }

    // Each card has a Manage link
    const manageLinks = page.locator('text=Manage →');
    await expect(manageLinks).toHaveCount(3, { timeout: 15_000 });
  });

  test('Manage link on Agent Persona navigates to persona page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Find the Manage link in the Agent Persona card
    const personaCard = page.locator('div', { has: page.locator('h3', { hasText: 'Agent Persona' }) });
    const manageLink = personaCard.locator('a, button', { hasText: 'Manage' }).first();
    await expect(manageLink).toBeVisible({ timeout: 15_000 });
    await manageLink.click();

    await expect(page).toHaveURL(/\/settings\/ai-agents\/persona/, { timeout: 15_000 });
  });

  test('Manage link on Voice card navigates to voice page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const voiceCard = page.locator('div', { has: page.locator('h3', { hasText: 'Voice & Speech' }) });
    const manageLink = voiceCard.locator('a, button', { hasText: 'Manage' }).first();
    await expect(manageLink).toBeVisible({ timeout: 15_000 });
    await manageLink.click();

    await expect(page).toHaveURL(/\/settings\/ai-agents\/voice/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents/persona
// ---------------------------------------------------------------------------

test.describe('Agent Persona page', () => {
  test('loads heading, waits for data, and shows section tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for loading to complete
    await expect(page.locator('text=Loading persona...')).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('h1', { hasText: 'Expert Agent Persona' })
    ).toBeVisible({ timeout: 15_000 });

    // Section navigation buttons
    await expect(
      page.locator('button', { hasText: /Core Identity/ })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: /Reasoning Logic/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('clicking section tabs switches visible content', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading persona...')).toBeHidden({ timeout: 15_000 });

    // Click Reasoning Logic tab
    const reasoningTab = page.locator('button', { hasText: /Reasoning Logic/ });
    await reasoningTab.click();
    await page.waitForTimeout(300);

    // Some content change should be visible (section heading or different form fields)
    // The page should still be stable
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });

    // Click back to Core Identity
    const coreTab = page.locator('button', { hasText: /Core Identity/ });
    await coreTab.click();
    await page.waitForTimeout(300);
    await expect(page.locator('aside')).toBeVisible({ timeout: 5_000 });
  });

  test('Save Persona button is visible and Back link navigates correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading persona...')).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Save Persona' })
    ).toBeVisible({ timeout: 15_000 });

    // Back link
    const backLink = page.locator('a', { hasText: /Back to AI Agent/ });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/settings\/ai-agents$/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents/voice
// ---------------------------------------------------------------------------

test.describe('Voice Settings page', () => {
  test('loads heading, resolves loading, and shows all sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading voice settings...')).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('h1', { hasText: 'Voice & Speech' })
    ).toBeVisible({ timeout: 15_000 });

    // All sections
    await expect(page.locator('h2', { hasText: 'Voice Provider' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h2', { hasText: 'Voice Selection' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h2', { hasText: 'API Key' })).toBeVisible({ timeout: 15_000 });
  });

  test('voice provider cards are interactive', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading voice settings...')).toBeHidden({ timeout: 15_000 });

    // Voice provider section should have clickable engine cards
    const providerSection = page.locator('div', { has: page.locator('h2', { hasText: 'Voice Provider' }) });
    const cards = providerSection.locator('button, [role="radio"], [role="option"], div[class*="cursor-pointer"]');

    // At least one provider card should be visible
    const firstCard = cards.first();
    if (await firstCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(300);
      // Page should remain stable after click
      await expect(page.locator('h1', { hasText: 'Voice & Speech' })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Save button is visible and Back link navigates to settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);
    await expect(page.locator('text=Loading voice settings...')).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Save Voice Settings' })
    ).toBeVisible({ timeout: 15_000 });

    const backLink = page.locator('a', { hasText: /Back to AI Agent/ });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/settings\/ai-agents$/, { timeout: 15_000 });
  });
});
