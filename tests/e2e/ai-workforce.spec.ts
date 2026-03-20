/**
 * AI Workforce Feature E2E Tests
 *
 * Covers mission control history, AI datasets, AI fine-tuning,
 * AI agent settings, agent persona, and voice settings pages.
 *
 * All tests are read-only — no missions are started, no AI calls triggered,
 * and no data is mutated.
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
  test('loads with heading and table column headers', async ({ page }) => {
    await page.goto(`${BASE_URL  }/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'Mission Control' })
    ).toBeVisible({ timeout: 15_000 });

    // Table header columns are always rendered regardless of data state
    await expect(page.locator('text=Title')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Status')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Steps')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Duration')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Date')).toBeVisible({ timeout: 15_000 });
  });

  test('loading resolves — empty state or mission rows appear', async ({ page }) => {
    await page.goto(`${BASE_URL  }/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for loading indicator to clear
    await expect(
      page.locator('text=Loading...')
    ).toBeHidden({ timeout: 15_000 });

    // Either empty message or at least one mission row with role="button"
    const emptyState = page.locator('text=No missions found.');
    const missionRow = page.locator('[role="button"]').first();
    await expect(emptyState.or(missionRow)).toBeVisible({ timeout: 10_000 });
  });

  test('does not navigate away from history page on load', async ({ page }) => {
    await page.goto(`${BASE_URL  }/mission-control/history`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(page).toHaveURL(/\/mission-control\/history/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// /ai/datasets
// ---------------------------------------------------------------------------

test.describe('AI Datasets page', () => {
  test('loads with heading and Create Dataset button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/ai/datasets`, {
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
    await page.goto(`${BASE_URL  }/ai/datasets`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('text=No datasets yet');
    const datasetGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(datasetGrid)).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /ai/fine-tuning
// ---------------------------------------------------------------------------

test.describe('AI Fine-Tuning page', () => {
  test('loads with heading and Start Fine-Tuning button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/ai/fine-tuning`, {
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
    await page.goto(`${BASE_URL  }/ai/fine-tuning`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    const emptyState = page.locator('text=No fine-tuning jobs yet');
    const jobGrid = page.locator('.grid.gap-4').first();
    await expect(emptyState.or(jobGrid)).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents
// ---------------------------------------------------------------------------

test.describe('AI Agent Settings page', () => {
  test('loads with heading and three agent option cards', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('h1', { hasText: 'AI Agent' })
    ).toBeVisible({ timeout: 15_000 });

    // All three option cards are always rendered
    await expect(
      page.locator('h3', { hasText: 'Agent Persona' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('h3', { hasText: 'Training Center' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('h3', { hasText: 'Voice & Speech' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('sub-heading describes the page purpose', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Manage your Sales & Customer Service AI Agent')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('each option card has a Manage link', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // All three cards render a "Manage →" call-to-action
    const manageLinks = page.locator('text=Manage →');
    await expect(manageLinks).toHaveCount(3, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents/persona
// ---------------------------------------------------------------------------

test.describe('Agent Persona page', () => {
  test('loads with heading and Save Persona button', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Either the main heading or the loading fallback must appear
    const heading = page.locator('h1', { hasText: 'Expert Agent Persona' });
    const loadingText = page.locator('text=Loading persona...');
    await expect(heading.or(loadingText)).toBeVisible({ timeout: 15_000 });

    // Wait for the loading state to clear
    await expect(loadingText).toBeHidden({ timeout: 15_000 });

    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('section navigation tabs are rendered', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Wait for loading to complete
    await expect(
      page.locator('text=Loading persona...')
    ).toBeHidden({ timeout: 15_000 });

    // Section navigation buttons (part of the inline section nav, not SubpageNav)
    await expect(
      page.locator('button', { hasText: /Core Identity/ })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: /Reasoning Logic/ })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Save Persona button is visible after loading', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading persona...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Save Persona' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Back to AI Agents breadcrumb link is present', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/persona`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading persona...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('a', { hasText: /Back to AI Agents/ })
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// /settings/ai-agents/voice
// ---------------------------------------------------------------------------

test.describe('Voice Settings page', () => {
  test('loads with heading and Voice Provider section', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // Either the full page heading or the loading state is shown first
    const heading = page.locator('h1', { hasText: 'Voice & Speech' });
    const loadingText = page.locator('text=Loading voice settings...');
    await expect(heading.or(loadingText)).toBeVisible({ timeout: 15_000 });

    // Wait for loading to finish
    await expect(loadingText).toBeHidden({ timeout: 15_000 });

    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('Voice Provider section with engine cards is rendered', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading voice settings...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('h2', { hasText: 'Voice Provider' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Voice Selection and API Key sections are rendered', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading voice settings...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('h2', { hasText: 'Voice Selection' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('h2', { hasText: 'API Key' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Save Voice Settings button is visible', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading voice settings...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: 'Save Voice Settings' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Back to AI Agent breadcrumb link is present', async ({ page }) => {
    await page.goto(`${BASE_URL  }/settings/ai-agents/voice`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    await expect(
      page.locator('text=Loading voice settings...')
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page.locator('a', { hasText: /Back to AI Agent/ })
    ).toBeVisible({ timeout: 15_000 });
  });
});
