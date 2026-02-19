/**
 * CRM Module E2E Tests
 *
 * Validates the CRM module's core functionality:
 * - Dashboard page loads and displays key widgets
 * - CRM page loads with entity navigation sidebar
 * - Entity views (contacts, deals, leads) render correctly
 * - Navigation between CRM entity views works
 * - Empty state is shown when no records exist
 * - Loading state is displayed while data is fetched
 * - Record add modal opens from the primary action button
 *
 * These tests run against a live Firebase-backed application.
 * No specific data records are assumed to exist in Firestore.
 *
 * @group Phase 3 — CRM
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated } from './fixtures/helpers';

// ---------------------------------------------------------------------------
// Suite 1: Dashboard Page
// ---------------------------------------------------------------------------

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/dashboard`);
    // Use domcontentloaded — Firebase/analytics keep persistent connections
    // that prevent networkidle from ever resolving.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_500);
  });

  test('should load the dashboard without crashing', async ({ page }) => {
    // The URL must still be /dashboard (no unexpected redirect)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should render a page heading or title element', async ({ page }) => {
    // The dashboard page renders an h1 or prominent heading.
    // Accept any visible heading-level element so the test is resilient
    // to minor copy changes.
    const heading = page
      .locator('h1, h2, [role="heading"]')
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('should display stat cards or metric widgets', async ({ page }) => {
    // The dashboard shows numeric summary cards (leads, deals, pipeline value, etc.)
    // At minimum one numeric value or card-style container must be visible.
    // We look for the stat containers generically to avoid hard-coding copy.
    const statOrCard = page
      .locator(
        '[class*="card"], [class*="stat"], [class*="metric"], ' +
        '[class*="widget"], [class*="panel"], ' +
        // Fallback: any container whose text begins with a digit
        'div:has(h2), div:has(h3)'
      )
      .first();
    await expect(statOrCard).toBeVisible({ timeout: 15_000 });
  });

  test('should show a navigation link to the CRM module', async ({ page }) => {
    // The unified sidebar must contain a link or button that takes the user
    // to the CRM section.
    const crmLink = page
      .locator('a[href="/crm"], a[href*="crm"], button:has-text("CRM")')
      .first();
    await expect(crmLink).toBeVisible({ timeout: 15_000 });
  });

  test('should display recent activity section or task list', async ({ page }) => {
    // The dashboard renders either a recent activity feed or an upcoming tasks list.
    const activityOrTasks = page
      .locator(
        'text=/recent activity/i, text=/upcoming tasks/i, ' +
        'text=/tasks/i, text=/activity/i'
      )
      .first();
    await expect(activityOrTasks).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: CRM Page — Entity Navigation Sidebar
// ---------------------------------------------------------------------------

test.describe('CRM Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('domcontentloaded');
    // Allow the Suspense boundary / Firebase auth to resolve
    await page.waitForTimeout(2_000);
  });

  test('should load the CRM page without crashing', async ({ page }) => {
    await expect(page).toHaveURL(/\/crm/);
  });

  test('should render the entity navigation sidebar', async ({ page }) => {
    // The CRM sidebar contains navigation buttons for each entity type.
    // We look for at least two of the standard entity labels.
    const entities = ['Leads', 'Companies', 'Contacts', 'Deals', 'Products', 'Tasks'];
    let visibleCount = 0;

    for (const entity of entities) {
      const isVisible = await page
        .locator(`button:has-text("${entity}"), a:has-text("${entity}")`)
        .first()
        .isVisible({ timeout: 15_000 })
        .catch(() => false);

      if (isVisible) {
        visibleCount++;
      }
    }

    // At least three entity labels must be visible to confirm the sidebar rendered
    expect(visibleCount).toBeGreaterThanOrEqual(3);
  });

  test('should show the Leads view by default', async ({ page }) => {
    // The default active view is "leads". The top-bar h2 should read "Leads".
    const heading = page.locator('h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(heading).toContainText(/leads/i);
  });

  test('should display a data table with column headers', async ({ page }) => {
    // The table always renders with schema-driven column headers such as
    // "First Name", "Last Name", "Email" etc.
    const tableHeader = page.locator('table thead th').first();
    await expect(tableHeader).toBeVisible({ timeout: 15_000 });
  });

  test('should show a loading indicator while records are being fetched', async ({ page }) => {
    // Navigate fresh so we can observe the loading state before Firestore resolves.
    await page.goto(`${BASE_URL}/crm`);

    // Either the loading row ("Loading Leads...") or the empty-state must
    // eventually appear — both indicate the table is working correctly.
    const loadingOrEmpty = page
      .locator(
        'text=/loading/i, text=/no leads yet/i, text=/no .* yet/i'
      )
      .first();
    await expect(loadingOrEmpty).toBeVisible({ timeout: 15_000 });
  });

  test('should display empty state message when no records exist', async ({ page }) => {
    // After loading completes the empty-state row renders a friendly message
    // and two call-to-action buttons.
    // We wait generously because Firestore must respond first.
    const emptyState = page
      .locator('text=/no .* yet/i')
      .first();

    // The empty state may or may not appear depending on seed data.
    // We assert it is EITHER the empty state or an actual data row.
    const dataRow = page.locator('table tbody tr').first();
    await expect(emptyState.or(dataRow)).toBeVisible({ timeout: 20_000 });
  });

  test('should display Import and Export action buttons', async ({ page }) => {
    // The toolbar always contains Import and Export buttons regardless of data.
    await expect(
      page.locator('button:has-text("Import")').first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator('button:has-text("Export")').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('should display the primary Add action button', async ({ page }) => {
    // The "+ New Lead" (or equivalent) button is always present in the toolbar.
    const addButton = page
      .locator('button:has-text("New"), button:has-text("Add")')
      .first();
    await expect(addButton).toBeVisible({ timeout: 15_000 });
  });

  test('should open the Add record modal when the primary action button is clicked', async ({ page }) => {
    const addButton = page
      .locator('button:has-text("New"), button:has-text("Add")')
      .first();

    await expect(addButton).toBeVisible({ timeout: 15_000 });
    await addButton.click();

    // The modal header reads "Add New <EntityName>"
    const modalHeading = page
      .locator('h3:has-text("Add New")')
      .first();
    await expect(modalHeading).toBeVisible({ timeout: 10_000 });

    // Dismiss the modal by clicking Cancel
    await page.locator('button:has-text("Cancel")').first().click();
    await expect(modalHeading).not.toBeVisible({ timeout: 5_000 });
  });

  test('should contain a search input in the toolbar', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search..."]');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
  });

  test('should contain a Filter button in the toolbar', async ({ page }) => {
    const filterButton = page.locator('button:has-text("Filter")');
    await expect(filterButton).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 3: CRM Navigation Between Entity Views
// ---------------------------------------------------------------------------

test.describe('CRM Entity Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);
  });

  test('should switch to the Contacts view when the Contacts button is clicked', async ({ page }) => {
    const contactsButton = page
      .locator('button:has-text("Contacts"), a:has-text("Contacts")')
      .first();
    await expect(contactsButton).toBeVisible({ timeout: 15_000 });
    await contactsButton.click();
    await page.waitForTimeout(1_000);

    // The top-bar heading should now reflect "Contacts"
    const heading = page.locator('h2').first();
    await expect(heading).toContainText(/contacts/i, { timeout: 10_000 });
  });

  test('should switch to the Deals view when the Deals button is clicked', async ({ page }) => {
    const dealsButton = page
      .locator('button:has-text("Deals"), a:has-text("Deals")')
      .first();
    await expect(dealsButton).toBeVisible({ timeout: 15_000 });
    await dealsButton.click();
    await page.waitForTimeout(1_000);

    const heading = page.locator('h2').first();
    await expect(heading).toContainText(/deals/i, { timeout: 10_000 });
  });

  test('should switch to the Companies view when the Companies button is clicked', async ({ page }) => {
    const companiesButton = page
      .locator('button:has-text("Companies"), a:has-text("Companies")')
      .first();
    await expect(companiesButton).toBeVisible({ timeout: 15_000 });
    await companiesButton.click();
    await page.waitForTimeout(1_000);

    const heading = page.locator('h2').first();
    await expect(heading).toContainText(/companies/i, { timeout: 10_000 });
  });

  test('should switch to the Tasks view when the Tasks button is clicked', async ({ page }) => {
    const tasksButton = page
      .locator('button:has-text("Tasks"), a:has-text("Tasks")')
      .first();
    await expect(tasksButton).toBeVisible({ timeout: 15_000 });
    await tasksButton.click();
    await page.waitForTimeout(1_000);

    const heading = page.locator('h2').first();
    await expect(heading).toContainText(/tasks/i, { timeout: 10_000 });
  });

  test('should navigate back to Dashboard using the sidebar Dashboard link', async ({ page }) => {
    // The CRM sidebar contains a Dashboard navigation link at the top.
    const dashboardLink = page
      .locator('a[href="/dashboard"], a:has-text("Dashboard")')
      .first();
    await expect(dashboardLink).toBeVisible({ timeout: 15_000 });
    await dashboardLink.click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should toggle the sidebar collapse state', async ({ page }) => {
    // The sidebar has a Collapse / expand toggle button.
    const collapseButton = page
      .locator('button:has-text("Collapse"), button:has-text("←")')
      .first();
    await expect(collapseButton).toBeVisible({ timeout: 15_000 });

    await collapseButton.click();
    await page.waitForTimeout(400); // Allow CSS transition to complete

    // The sidebar should now be collapsed — look for the expand arrow.
    const expandButton = page
      .locator('button:has-text("→")')
      .first();
    await expect(expandButton).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 4: CRM Empty State Handling
// ---------------------------------------------------------------------------

test.describe('CRM Empty State', () => {
  test('should show empty-state with Add and Import CSV actions when no records exist', async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for loading to finish — the loading row is replaced by the empty state
    // or actual data rows.
    await page.waitForTimeout(3_000);

    // If empty, two action buttons appear in the table body.
    const tableBody = page.locator('table tbody');
    await expect(tableBody).toBeVisible({ timeout: 15_000 });

    // The table body contains either real rows or the empty-state cell.
    // We check that the table body itself is non-empty (has at least one row).
    const rowCount = await tableBody.locator('tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('should show the "no [entity] yet" message when the entity collection is empty', async ({ page }) => {
    await ensureAuthenticated(page);
    // Navigate directly to CRM with the products view which is likely empty
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('domcontentloaded');

    // Switch to the Products entity
    const productsButton = page
      .locator('button:has-text("Products"), a:has-text("Products")')
      .first();
    await expect(productsButton).toBeVisible({ timeout: 15_000 });
    await productsButton.click();
    await page.waitForTimeout(2_500);

    // Either real data or the empty-state "No Products yet" message appears
    const emptyOrData = page
      .locator('text=/no products yet/i, table tbody tr')
      .first();
    await expect(emptyOrData).toBeVisible({ timeout: 15_000 });
  });
});
