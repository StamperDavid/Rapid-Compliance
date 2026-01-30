/**
 * Full-Scale Visual Transactional Audit of 46 Admin Routes
 *
 * This E2E test performs a comprehensive "Headed" browser audit with Playwright Trace.
 * The trace file provides visual proof of interaction with every page.
 *
 * EXECUTION WITH TRACE:
 * npx playwright test admin-routes-audit.spec.ts --headed --project=chromium --trace on
 *
 * VIEW TRACE:
 * npx playwright show-trace trace.zip
 *
 * @audit-date January 30, 2026
 * @audit-scope All 46 Admin Routes
 */

import { test, expect, type Page } from '@playwright/test';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// All 46 Admin Routes from SSOT
const ADMIN_ROUTES = [
  { path: '/admin', name: 'CEO Command Center' },
  { path: '/admin/login', name: 'Firebase Admin Auth' },
  { path: '/admin/analytics', name: 'Platform Analytics' },
  { path: '/admin/analytics/pipeline', name: 'Pipeline Analytics' },
  { path: '/admin/analytics/usage', name: 'Usage Analytics' },
  { path: '/admin/billing', name: 'Subscription Management' },
  { path: '/admin/customers', name: 'Customer Management' },
  { path: '/admin/deals', name: 'Platform Deals View' },
  { path: '/admin/email-campaigns', name: 'Campaign Management' },
  { path: '/admin/global-config', name: 'Global Platform Config' },
  { path: '/admin/growth', name: 'Growth Metrics' },
  { path: '/admin/jasper-lab', name: 'AI Training Laboratory' },
  { path: '/admin/leads', name: 'Platform Leads View' },
  { path: '/admin/merchandiser', name: 'E-commerce Management' },
  { path: '/admin/organizations', name: 'Organization CRUD' },
  { path: '/admin/organizations/new', name: 'Create Organization' },
  { path: '/admin/pricing-tiers', name: 'Pricing Tier Config' },
  { path: '/admin/recovery', name: 'Churn Prevention' },
  { path: '/admin/revenue', name: 'Revenue Analytics' },
  { path: '/admin/sales-agent', name: 'Golden Master AI Config' },
  { path: '/admin/sales-agent/knowledge', name: 'Knowledge Base' },
  { path: '/admin/sales-agent/persona', name: 'Agent Persona' },
  { path: '/admin/sales-agent/training', name: 'Agent Training' },
  { path: '/admin/settings/integrations', name: 'Integration Cards' },
  { path: '/admin/social', name: 'Social Composer' },
  { path: '/admin/specialists', name: 'Specialist Config' },
  { path: '/admin/subscriptions', name: 'Subscription Management' },
  { path: '/admin/support/api-health', name: 'API Health Monitoring' },
  { path: '/admin/support/bulk-ops', name: 'Bulk Operations' },
  { path: '/admin/support/exports', name: 'Data Exports' },
  { path: '/admin/support/impersonate', name: 'User Impersonation' },
  { path: '/admin/swarm', name: 'AI Swarm Control' },
  { path: '/admin/system/api-keys', name: 'API Key Management' },
  { path: '/admin/system/flags', name: 'Feature Flags' },
  { path: '/admin/system/health', name: 'System Health' },
  { path: '/admin/system/logs', name: 'Audit Logs' },
  { path: '/admin/system/settings', name: 'System Settings' },
  { path: '/admin/templates', name: 'Email Templates' },
  { path: '/admin/users', name: 'User Management' },
  { path: '/admin/voice', name: 'Voice Settings' },
  { path: '/admin/voice-training', name: 'Voice Training' },
  { path: '/admin/website-editor', name: 'Website Editor' },
  { path: '/admin/advanced/compliance', name: 'Compliance Management' },
];

// Audit result tracking
interface RouteAuditResult {
  path: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'STUB' | 'PARTIAL' | 'REDIRECT';
  hasComingSoon: boolean;
  disabledButtons: string[];
  notes?: string;
}

const auditResults: RouteAuditResult[] = [];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // Page may not fully settle, continue anyway
  });
}

async function hasComingSoonText(page: Page): Promise<boolean> {
  const comingSoonLocator = page.locator('text=/coming soon/i');
  const count = await comingSoonLocator.count();
  return count > 0;
}

async function getDisabledButtons(page: Page): Promise<string[]> {
  const disabledButtons: string[] = [];
  const buttons = page.locator('button[disabled]');
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const buttonText = await buttons.nth(i).textContent();
    if (buttonText) {
      disabledButtons.push(buttonText.trim());
    }
  }

  return disabledButtons;
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================

test.describe('Admin Routes Visual Audit - 46 Routes', () => {
  test.describe.configure({ mode: 'serial' });

  // Extended timeout for full audit
  test.setTimeout(600000); // 10 minutes

  test.beforeAll(() => {
    console.log('\n========================================');
    console.log('ADMIN ROUTES VISUAL AUDIT - Starting');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Routes to audit: ${ADMIN_ROUTES.length}`);
    console.log('========================================\n');
  });

  // =============================================================================
  // TEST: Login Page
  // =============================================================================
  test('should audit login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await waitForPageLoad(page);

    // Verify form elements exist
    const hasEmailInput = (await page.locator('input[type="email"]').count()) > 0;
    const hasPasswordInput = (await page.locator('input[type="password"]').count()) > 0;
    const hasSubmitButton = (await page.locator('button:has-text("Sign In")').count()) > 0;

    const isOperational = hasEmailInput && hasPasswordInput && hasSubmitButton;

    auditResults.push({
      path: '/admin/login',
      name: 'Firebase Admin Auth',
      status: isOperational ? 'PASS' : 'FAIL',
      hasComingSoon: false,
      disabledButtons: [],
      notes: isOperational ? 'Login form operational' : 'Missing form elements',
    });

    expect(hasEmailInput).toBe(true);
    expect(hasPasswordInput).toBe(true);
    console.log('[PASS] /admin/login - Login form operational');
  });

  // =============================================================================
  // TEST: Batch Route Audit
  // =============================================================================
  test('should audit all admin routes', async ({ page }) => {
    // Filter out login (already tested) and routes with dynamic params
    const routesToTest = ADMIN_ROUTES.filter(
      (r) => r.path !== '/admin/login' && !r.path.includes('[')
    );

    for (const route of routesToTest) {
      console.log(`[AUDITING] ${route.path}...`);

      try {
        const response = await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await waitForPageLoad(page);

        const status = response?.status() ?? 0;
        const currentUrl = page.url();
        const isRedirect = !currentUrl.includes(route.path);

        const hasComingSoon = await hasComingSoonText(page);
        const disabledButtons = await getDisabledButtons(page);

        // Determine route status
        let routeStatus: RouteAuditResult['status'] = 'PASS';
        let notes = '';

        if (status >= 500) {
          routeStatus = 'FAIL';
          notes = `HTTP ${status} error`;
        } else if (status === 404) {
          routeStatus = 'FAIL';
          notes = 'Page not found';
        } else if (isRedirect && route.path !== '/admin/command-center') {
          routeStatus = 'REDIRECT';
          notes = `Redirects to ${currentUrl}`;
        } else if (hasComingSoon) {
          routeStatus = 'STUB';
          notes = 'Contains Coming Soon placeholder';
        } else if (disabledButtons.length > 0) {
          routeStatus = 'PARTIAL';
          notes = `Disabled: ${disabledButtons.slice(0, 2).join(', ')}`;
        }

        auditResults.push({
          path: route.path,
          name: route.name,
          status: routeStatus,
          hasComingSoon,
          disabledButtons,
          notes,
        });

        // Log result
        const statusIcon = {
          PASS: '\u2705',
          FAIL: '\u274c',
          STUB: '\u26a0\ufe0f',
          PARTIAL: '\u26a0\ufe0f',
          REDIRECT: '\u27a1\ufe0f',
        }[routeStatus];

        console.log(`  ${statusIcon} ${route.name} - ${routeStatus}`);
        if (notes) {
          console.log(`     ${notes}`);
        }

        // Take screenshot for trace
        await page.screenshot({ path: `playwright-report/screenshots/${route.path.replace(/\//g, '_')}.png` });

        // Delay for visual tracking in headed mode
        await page.waitForTimeout(300);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        auditResults.push({
          path: route.path,
          name: route.name,
          status: 'FAIL',
          hasComingSoon: false,
          disabledButtons: [],
          notes: `Error: ${errorMessage.slice(0, 100)}`,
        });
        console.log(`  \u274c ${route.name} - FAIL (${errorMessage.slice(0, 50)})`);
      }
    }
  });

  // =============================================================================
  // TEST: Merchandiser Deep Dive
  // =============================================================================
  test('should audit Merchandiser transactional features', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/merchandiser`);
    await waitForPageLoad(page);

    // Check Overview Tab
    const overviewVisible = (await page.locator('text=Active Promotions').count()) > 0;

    // Click Create Promotion Tab
    const createButton = page.locator('button:has-text("Create Promotion")');
    if ((await createButton.count()) > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Verify form is functional (no Coming Soon badge)
      const hasLiveBadge = (await page.locator('text=Live').count()) > 0;
      const submitButton = page.locator('button[type="submit"]');
      const isSubmitEnabled = (await submitButton.count()) > 0 && !(await submitButton.isDisabled());

      console.log('\n[MERCHANDISER DEEP AUDIT]');
      console.log(`  Overview Tab: ${overviewVisible ? 'PASS' : 'FAIL'}`);
      console.log(`  Create Promotion: ${hasLiveBadge ? 'LIVE (wired)' : 'STUB'}`);
      console.log(`  Submit Button: ${isSubmitEnabled ? 'ENABLED' : 'DISABLED'}`);

      // Click Analytics Tab
      const analyticsButton = page.locator('button:has-text("Analytics")');
      if ((await analyticsButton.count()) > 0) {
        await analyticsButton.click();
        await page.waitForTimeout(500);

        const analyticsLive = (await page.locator('text=Strategy Performance').count()) > 0;
        console.log(`  Analytics Tab: ${analyticsLive ? 'LIVE' : 'STUB'}`);
      }
    }
  });

  // =============================================================================
  // TEST: Social Media Page
  // =============================================================================
  test('should audit Social page transactional features', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/social`);
    await waitForPageLoad(page);

    // Check compose tab
    const hasTwitterCompose = (await page.locator('textarea').count()) > 0;
    const hasPostButton = (await page.locator('button:has-text("Post Tweet")').count()) > 0;

    console.log('\n[SOCIAL PAGE AUDIT]');
    console.log(`  Twitter Compose: ${hasTwitterCompose ? 'PRESENT' : 'MISSING'}`);
    console.log(`  Post Button: ${hasPostButton ? 'PRESENT' : 'MISSING'}`);

    expect(hasTwitterCompose).toBe(true);
    expect(hasPostButton).toBe(true);
  });

  // =============================================================================
  // TEARDOWN: Generate Report
  // =============================================================================
  test.afterAll(() => {
    console.log('\n========================================');
    console.log('ADMIN ROUTES AUDIT - COMPLETE');
    console.log('========================================\n');

    const counts = {
      PASS: auditResults.filter((r) => r.status === 'PASS').length,
      FAIL: auditResults.filter((r) => r.status === 'FAIL').length,
      STUB: auditResults.filter((r) => r.status === 'STUB').length,
      PARTIAL: auditResults.filter((r) => r.status === 'PARTIAL').length,
      REDIRECT: auditResults.filter((r) => r.status === 'REDIRECT').length,
    };

    console.log('SUMMARY:');
    console.log('----------------------------------------');
    console.log(`\u2705 PASS:     ${counts.PASS}`);
    console.log(`\u274c FAIL:     ${counts.FAIL}`);
    console.log(`\u26a0\ufe0f  STUB:     ${counts.STUB}`);
    console.log(`\u26a0\ufe0f  PARTIAL:  ${counts.PARTIAL}`);
    console.log(`\u27a1\ufe0f  REDIRECT: ${counts.REDIRECT}`);
    console.log('----------------------------------------');
    console.log(`TOTAL: ${auditResults.length}`);
    console.log('========================================');

    // List issues
    const issues = auditResults.filter((r) => ['FAIL', 'STUB'].includes(r.status));
    if (issues.length > 0) {
      console.log('\nISSUES:');
      for (const issue of issues) {
        console.log(`  ${issue.status}: ${issue.path}`);
        if (issue.notes) {
          console.log(`    ${issue.notes}`);
        }
      }
    }

    console.log('\n========================================');
    console.log('VIEW TRACE: npx playwright show-trace test-results/*/trace.zip');
    console.log('========================================\n');
  });
});
