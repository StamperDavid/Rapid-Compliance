/**
 * CRM E2E Spec
 *
 * Tests CRM-related pages:
 *   - /entities/leads   (reached via /leads redirect)
 *   - /entities/contacts (reached via /contacts redirect)
 *   - /deals
 *
 * All tests run in the `chromium` project with stored auth state.
 * `ensureAuthenticated` is called in beforeEach as a fallback for sessions
 * that could not be restored from storage state.
 *
 * Selectors are derived from:
 *   - src/app/(dashboard)/entities/[entityName]/page.tsx
 *   - src/app/(dashboard)/deals/page.tsx
 *
 * Tests exercise structure and UI controls only — no data is created unless
 * the test specifically covers the creation flow, in which case the ID MUST
 * start with E2E_TEMP_ (handled in the individual test).
 */

import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageReady } from './fixtures/helpers';
import { BASE_URL } from './fixtures/test-accounts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a path and wait for the loading spinner / auth gate to clear.
 * The dashboard layout shows "Loading..." until Firebase auth resolves.
 */
async function goTo(
  page: import('@playwright/test').Page,
  path: string
): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await waitForPageReady(page);

  // Wait for the auth loading screen to disappear (spins until session restores)
  const authLoading = page.locator('p', { hasText: 'Loading...' }).first();
  if (await authLoading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await authLoading.waitFor({ state: 'hidden', timeout: 30_000 });
  }

  // Wait for sidebar to confirm layout is mounted
  await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for the entity page to finish loading its records.
 * The entity page shows a "Loading …" paragraph while fetching.
 */
async function waitForEntityPageLoaded(page: import('@playwright/test').Page): Promise<void> {
  // The entity page shows ⏳ + "Loading <entity>..." while fetching
  const entityLoadingIndicator = page.locator('text=Loading...').last();
  if (await entityLoadingIndicator.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await entityLoadingIndicator.waitFor({ state: 'hidden', timeout: 30_000 });
  }
  // Also wait a moment for React state to settle
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});

// ---------------------------------------------------------------------------
// Leads (/entities/leads)
// ---------------------------------------------------------------------------

test.describe('Leads page (/entities/leads)', () => {
  test('page loads and displays leads entity heading', async ({ page }) => {
    // /leads redirects to /entities/leads
    await goTo(page, '/leads');

    // Confirm redirect completed
    await page.waitForURL(/\/entities\/leads/, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await waitForEntityPageLoaded(page);

    // The entity page renders an h1 with the schema pluralName ("Leads")
    await expect(
      page.locator('h1').filter({ hasText: /leads/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('leads page contains a data table', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    // The entity page always renders a <table> once loading is done
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  });

  test('leads table has expected column headers', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    const thead = page.locator('table thead').first();
    await expect(thead).toBeVisible({ timeout: 15_000 });

    // The leads schema exposes at least a "Name" column and an "Actions" column.
    // tableFields shows up to 5 non-lookup, non-longText fields.
    await expect(thead.locator('th', { hasText: /name/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(thead.locator('th', { hasText: /actions/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('leads page has a search input', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    // The entity page renders an input with placeholder "Search..."
    await expect(
      page.locator('input[placeholder="Search..."]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('leads page has an Add button', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    // The Add button text is "Add {singularName}" — for leads it is "Add Lead"
    // but we use a broad matcher to avoid schema-name sensitivity.
    await expect(
      page.locator('button', { hasText: /^\+?\s*Add/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Add button opens the record creation modal', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    const addButton = page.locator('button', { hasText: /^\+?\s*Add/i }).first();
    await addButton.click();

    // The modal renders an h2 with "Add {singularName}"
    await expect(
      page.locator('h2', { hasText: /Add/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Modal has a form with at least one input
    await expect(page.locator('[style*="inset"]').locator('input').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('closing the Add modal dismisses it', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    const addButton = page.locator('button', { hasText: /^\+?\s*Add/i }).first();
    await addButton.click();

    // Wait for modal
    await expect(
      page.locator('h2', { hasText: /Add/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Close via the ✕ button in the modal header
    const closeButton = page.locator('[style*="inset"] button').filter({ hasText: '✕' }).first();
    await closeButton.click();

    // Modal should be gone
    await expect(
      page.locator('h2', { hasText: /Add/i }).first()
    ).toBeHidden({ timeout: 10_000 });
  });

  test('leads page shows filter controls for singleSelect fields', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    // The Filters button is only rendered when filterableFields.length > 0.
    // For the leads schema there are singleSelect fields (status, lead_source).
    const filtersButton = page.locator('button', { hasText: /filters/i }).first();
    await expect(filtersButton).toBeVisible({ timeout: 15_000 });
  });

  test('search filters the table rows', async ({ page }) => {
    await goTo(page, '/entities/leads');
    await waitForEntityPageLoaded(page);

    const searchInput = page.locator('input[placeholder="Search..."]').first();
    await searchInput.fill('zzzzz_no_match_e2e');

    // After typing a non-matching term, empty state message should appear
    // or the row count should be 0.
    await expect(
      page
        .locator('text=No leads matching')
        .or(page.locator('text=No records matching'))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // Clear the search to restore normal state
    await searchInput.fill('');
  });
});

// ---------------------------------------------------------------------------
// Contacts (/entities/contacts)
// ---------------------------------------------------------------------------

test.describe('Contacts page (/entities/contacts)', () => {
  test('page loads and displays contacts entity heading', async ({ page }) => {
    // /contacts redirects to /entities/contacts
    await goTo(page, '/contacts');

    await page.waitForURL(/\/entities\/contacts/, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await waitForEntityPageLoaded(page);

    await expect(
      page.locator('h1').filter({ hasText: /contacts/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('contacts page contains a data table', async ({ page }) => {
    await goTo(page, '/entities/contacts');
    await waitForEntityPageLoaded(page);

    await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  });

  test('contacts table has Name and Actions column headers', async ({ page }) => {
    await goTo(page, '/entities/contacts');
    await waitForEntityPageLoaded(page);

    const thead = page.locator('table thead').first();
    await expect(thead.locator('th', { hasText: /name/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(thead.locator('th', { hasText: /actions/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('contacts page has a search input', async ({ page }) => {
    await goTo(page, '/entities/contacts');
    await waitForEntityPageLoaded(page);

    await expect(
      page.locator('input[placeholder="Search..."]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('contacts page has an Add button', async ({ page }) => {
    await goTo(page, '/entities/contacts');
    await waitForEntityPageLoaded(page);

    await expect(
      page.locator('button', { hasText: /^\+?\s*Add/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Deals (/deals)
// ---------------------------------------------------------------------------

test.describe('Deals page (/deals)', () => {
  test('deals page loads and displays the pipeline heading', async ({ page }) => {
    await goTo(page, '/deals');

    // The deals page renders h1 "Deals Pipeline"
    await expect(
      page.locator('h1', { hasText: 'Deals Pipeline' }).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('deals page shows pipeline view by default with stage columns', async ({ page }) => {
    await goTo(page, '/deals');

    // Wait for deals to load (spinner disappears)
    const spinner = page.locator('text=Loading deals...');
    if (await spinner.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 30_000 });
    }

    // Pipeline view renders stage cards — at minimum "prospecting" and
    // "qualification" headers should be visible
    await expect(
      page.locator('h3', { hasText: /prospecting/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('h3', { hasText: /qualification/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('deals page has a New Deal button', async ({ page }) => {
    await goTo(page, '/deals');

    // The header contains a "New Deal" button
    await expect(
      page.locator('button', { hasText: /new deal/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('deals page has pipeline and list view toggle buttons', async ({ page }) => {
    await goTo(page, '/deals');

    await expect(
      page.locator('button', { hasText: /pipeline/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button', { hasText: /list/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('switching to list view renders a data table with correct headers', async ({ page }) => {
    await goTo(page, '/deals');

    // Switch to list view
    const listButton = page.locator('button', { hasText: /^List$/i }).first();
    await expect(listButton).toBeVisible({ timeout: 15_000 });
    await listButton.click();

    // The DataTable component renders a table with Deal, Company, Value, Stage,
    // Probability, Source, Actions columns
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const thead = table.locator('thead');
    await expect(thead.locator('th', { hasText: /deal/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(thead.locator('th', { hasText: /stage/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(thead.locator('th', { hasText: /value/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('list view has a search input', async ({ page }) => {
    await goTo(page, '/deals');

    const listButton = page.locator('button', { hasText: /^List$/i }).first();
    await expect(listButton).toBeVisible({ timeout: 15_000 });
    await listButton.click();

    // DataTable renders a search input with placeholder "Search deals..."
    await expect(
      page.locator('input[placeholder="Search deals..."]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('deals pipeline shows all 6 stage columns', async ({ page }) => {
    await goTo(page, '/deals');

    const spinner = page.locator('text=Loading deals...');
    if (await spinner.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 30_000 });
    }

    const expectedStages = [
      'prospecting',
      'qualification',
      'proposal',
      'negotiation',
      'closed won',
      'closed lost',
    ];

    for (const stage of expectedStages) {
      await expect(
        page.locator('h3', { hasText: new RegExp(stage, 'i') }).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('pipeline total value and deal count are visible in the header', async ({ page }) => {
    await goTo(page, '/deals');

    const spinner = page.locator('text=Loading deals...');
    if (await spinner.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 30_000 });
    }

    // The deals header renders: "{n} deals • ${total} total value"
    // This is always present (even when 0) once the page loads.
    await expect(
      page.locator('p', { hasText: /deals.*total value/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
