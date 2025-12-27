/**
 * End-to-End Tests for Website Builder
 * Tests the complete workflow from creation to publishing
 */

import { test, expect } from '@playwright/test';

const ORG_ID = 'test-org-001';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Website Builder E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to website builder
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/settings`);
  });

  test('should configure site settings', async ({ page }) => {
    // Fill in site settings
    await page.fill('[name="siteName"]', 'Test Company');
    await page.fill('[name="subdomain"]', 'testcompany');
    await page.fill('[name="seoTitle"]', 'Test Company - Leading Solutions');
    await page.fill('[name="seoDescription"]', 'We provide the best solutions');

    // Save settings
    await page.click('button:has-text("Save Settings")');

    // Wait for success message
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();
  });

  test('should create a new page', async ({ page }) => {
    // Navigate to pages
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/pages`);

    // Create new page
    await page.click('button:has-text("Create Page")');

    // Fill in page details
    await page.fill('[name="title"]', 'About Us');
    await page.fill('[name="slug"]', 'about');

    // Save page
    await page.click('button:has-text("Create")');

    // Verify page was created
    await expect(page.locator('text=About Us')).toBeVisible();
  });

  test('should add widgets to page using visual editor', async ({ page }) => {
    // Navigate to editor
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/editor?pageId=test-page`);

    // Wait for editor to load
    await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible();

    // Drag heading widget to canvas
    await page.dragAndDrop(
      '[data-widget-type="heading"]',
      '[data-testid="editor-canvas"]'
    );

    // Verify widget was added
    await expect(page.locator('[data-widget-type="heading"]').nth(1)).toBeVisible();

    // Edit widget content
    await page.click('[data-widget-type="heading"]').nth(1);
    await page.fill('[name="widgetContent"]', 'Welcome to Our Site');

    // Save changes
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Page saved')).toBeVisible();
  });

  test('should apply template to page', async ({ page }) => {
    // Navigate to templates
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/templates`);

    // Select business template
    await page.click('[data-template="business-landing"]');

    // Preview template
    await page.click('button:has-text("Preview")');

    // Apply template to new page
    await page.click('button:has-text("Use Template")');
    await page.fill('[name="title"]', 'Homepage');
    await page.fill('[name="slug"]', 'home');
    await page.click('button:has-text("Create")');

    // Verify page was created with template
    await expect(page.locator('text=Homepage created successfully')).toBeVisible();
  });

  test('should publish a page', async ({ page }) => {
    // Navigate to page editor
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/editor?pageId=test-page`);

    // Click publish button
    await page.click('button:has-text("Publish")');

    // Confirm publish
    await page.click('button:has-text("Confirm")');

    // Verify publish success
    await expect(page.locator('text=Page published successfully')).toBeVisible();

    // Check status changed to published
    await expect(page.locator('[data-status="published"]')).toBeVisible();
  });

  test('should schedule page for future publishing', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/editor?pageId=test-page`);

    // Click schedule button
    await page.click('button:has-text("Schedule")');

    // Set future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.fill('[name="scheduledFor"]', futureDate.toISOString().split('T')[0]);

    // Confirm schedule
    await page.click('button:has-text("Schedule Publish")');

    // Verify scheduled status
    await expect(page.locator('[data-status="scheduled"]')).toBeVisible();
  });

  test('should generate and view preview link', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/editor?pageId=test-page`);

    // Click preview button
    await page.click('button:has-text("Preview")');

    // Wait for preview link to be generated
    await expect(page.locator('[data-testid="preview-link"]')).toBeVisible();

    // Get preview URL
    const previewUrl = await page.locator('[data-testid="preview-link"]').getAttribute('href');

    // Open preview in new tab
    const previewPage = await page.context().newPage();
    await previewPage.goto(previewUrl!);

    // Verify preview page loads
    await expect(previewPage.locator('[data-testid="preview-banner"]')).toBeVisible();
    await expect(previewPage.locator('text=Preview Mode')).toBeVisible();

    await previewPage.close();
  });

  test('should add and verify custom domain', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/domains`);

    // Add custom domain
    await page.click('button:has-text("Add Domain")');
    await page.fill('[name="domain"]', 'example.com');
    await page.click('button:has-text("Add")');

    // Verify domain was added
    await expect(page.locator('text=example.com')).toBeVisible();

    // Check DNS instructions
    await page.click('button:has-text("Show DNS Records")');
    await expect(page.locator('text=CNAME')).toBeVisible();
  });

  test('should create and publish blog post', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/blog`);

    // Create new post
    await page.click('button:has-text("New Post")');

    // Fill in post details
    await page.fill('[name="title"]', 'My First Blog Post');
    await page.fill('[name="slug"]', 'my-first-blog-post');
    await page.fill('[name="excerpt"]', 'This is an exciting blog post');

    // Add category
    await page.click('button:has-text("Add Category")');
    await page.fill('[name="category"]', 'News');

    // Save draft
    await page.click('button:has-text("Save Draft")');

    // Publish post
    await page.click('button:has-text("Publish")');

    // Verify published
    await expect(page.locator('[data-status="published"]')).toBeVisible();
  });

  test('should manage navigation menu', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/navigation`);

    // Add menu item
    await page.click('button:has-text("Add Item")');
    await page.fill('[name="label"]', 'About');
    await page.fill('[name="url"]', '/about');
    await page.click('button:has-text("Save")');

    // Verify menu item added
    await expect(page.locator('text=About')).toBeVisible();

    // Reorder menu items (drag and drop)
    await page.dragAndDrop(
      '[data-menu-item="0"]',
      '[data-menu-item="1"]'
    );

    // Save menu
    await page.click('button:has-text("Save Menu")');

    await expect(page.locator('text=Menu saved')).toBeVisible();
  });

  test('should view audit log', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/website/settings`);

    // Navigate to audit log
    await page.click('text=Audit Log');

    // Verify log entries are visible
    await expect(page.locator('[data-testid="audit-entry"]')).toBeVisible();

    // Filter by type
    await page.selectOption('[name="eventType"]', 'page_published');

    // Verify filtered results
    await expect(page.locator('text=page_published')).toBeVisible();
  });

  test('should test responsive design', async ({ page }) => {
    await page.goto(`${BASE_URL}/sites/${ORG_ID}/home`);

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-hamburger"]')).toBeVisible();

    // Open mobile menu
    await page.click('[data-testid="mobile-hamburger"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should test accessibility features', async ({ page }) => {
    await page.goto(`${BASE_URL}/sites/${ORG_ID}/home`);

    // Test skip to main content
    await page.keyboard.press('Tab');
    await expect(page.locator('text=Skip to main content')).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    // Check ARIA labels
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });
});

test.describe('Multi-tenant Isolation', () => {
  test('should not allow access to other org data', async ({ page }) => {
    const ORG_A = 'org-a';
    const ORG_B = 'org-b';

    // Create page in Org A
    await page.goto(`${BASE_URL}/workspace/${ORG_A}/website/pages`);
    await page.click('button:has-text("Create Page")');
    await page.fill('[name="title"]', 'Org A Page');
    await page.fill('[name="slug"]', 'org-a-page');
    await page.click('button:has-text("Create")');

    // Try to access Org A's page from Org B
    const response = await page.request.get(
      `${BASE_URL}/api/website/pages?organizationId=${ORG_B}&slug=org-a-page`
    );

    // Verify page not found (isolated)
    const data = await response.json();
    expect(data.pages).toHaveLength(0);
  });
});

test.describe('Performance', () => {
  test('should load pages quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/sites/${ORG_ID}/home`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should optimize images', async ({ page }) => {
    await page.goto(`${BASE_URL}/sites/${ORG_ID}/home`);

    // Check that images have proper attributes
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const loading = await img.getAttribute('loading');

      // All images should have alt text
      expect(alt).toBeTruthy();

      // Non-critical images should lazy load
      const isPriority = await img.getAttribute('data-priority');
      if (!isPriority) {
        expect(loading).toBe('lazy');
      }
    }
  });
});

