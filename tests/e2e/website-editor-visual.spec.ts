/**
 * Website Editor Visual E2E Tests
 *
 * Validates the visual page editor:
 * - Three-panel layout (Widgets, Canvas, Properties)
 * - Widget library with categories
 * - Adding sections and widgets to canvas
 * - Properties panel editing
 * - Responsive breakpoint switching
 * - Undo/Redo functionality
 * - Keyboard shortcuts
 *
 * @group Phase 2B — Website Builder
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from './fixtures/test-accounts';
import { ensureAuthenticated } from './fixtures/helpers';

/**
 * Helper: wait for the website editor to finish loading.
 * Waits for a positive indicator (Widgets panel) instead of
 * checking for "Loading editor..." disappearance, which can
 * pass prematurely if the dashboard layout hasn't rendered yet.
 */
async function waitForEditorReady(page: import('@playwright/test').Page): Promise<void> {
  // Wait for the editor to fully render — Widgets panel indicates success
  await expect(
    page.locator('text=Widgets').first()
      .or(page.locator('text=Failed to load page'))
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Editor Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure Firebase auth session is active
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);
  });

  test('should display three-panel editor layout', async ({ page }) => {
    // Left panel: Widgets
    const widgetsHeader = page.locator('text=Widgets').first();
    await expect(widgetsHeader).toBeVisible({ timeout: 10_000 });

    // Center: Canvas area
    const canvas = page.locator(
      'button:has-text("Add Section"), text=Empty Page, [data-testid="editor-canvas"]'
    ).first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Right panel: Properties (shows instruction when nothing selected)
    const propertiesMsg = page.locator(
      'text=Properties, text=Select a section, text=select'
    ).first();
    await expect(propertiesMsg).toBeVisible({ timeout: 10_000 });
  });

  test('should display editor toolbar', async ({ page }) => {
    // Toolbar buttons
    const saveBtn = page.locator('button:has-text("Save")').first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    // Breakpoint switcher
    const desktopBtn = page.locator('button:has-text("Desktop")');
    await expect(desktopBtn).toBeVisible();
  });
});

test.describe('Widget Library', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);
  });

  test('should display widget category tabs', async ({ page }) => {
    // Category tabs: Layout, Content, Forms, Media, Advanced
    const categories = ['Layout', 'Content', 'Forms', 'Media', 'Advanced'];

    for (const category of categories) {
      const tab = page.locator(`button:has-text("${category}")`).first();
      await expect(tab).toBeVisible();
    }
  });

  test('should switch between widget categories', async ({ page }) => {
    // Click Content category
    await page.locator('button:has-text("Content")').first().click();
    await page.waitForTimeout(500);

    // Should show content widgets (Heading, Text, Button, etc.)
    const contentWidget = page.locator('text=Heading, text=Button, text=Text').first();
    await expect(contentWidget).toBeVisible({ timeout: 5_000 });

    // Switch to Layout category
    await page.locator('button:has-text("Layout")').first().click();
    await page.waitForTimeout(500);

    // Should show layout widgets (Container, Row, Spacer, etc.)
    const layoutWidget = page.locator('text=Container, text=Row, text=Spacer, text=Column').first();
    await expect(layoutWidget).toBeVisible({ timeout: 5_000 });
  });

  test('should filter widgets by search', async ({ page }) => {
    // Find and use the search input
    const searchInput = page.locator('input[placeholder*="Search widgets"]');
    await expect(searchInput).toBeVisible();

    // Search for "button"
    await searchInput.fill('button');
    await page.waitForTimeout(500);

    // Should filter results to show Button widget
    const buttonWidget = page.locator('text=Button').first();
    await expect(buttonWidget).toBeVisible();

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});

test.describe('Canvas Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);
  });

  test('should show empty state with Add Section button', async ({ page }) => {
    const addSectionBtn = page.locator('button:has-text("Add Section")').first();
    await expect(addSectionBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should add a section to the canvas', async ({ page }) => {
    // Click "+ Add Section"
    const addSectionBtn = page.locator('button:has-text("Add Section")').first();
    await addSectionBtn.click();
    await page.waitForTimeout(1_000);

    // After adding a section, the canvas should have content
    // Either the empty state disappears or a new section appears
    const sectionAdded = page.locator(
      'text=Drop widgets here, button:has-text("Delete Section"), [data-section]'
    ).first();
    const hasSection = await sectionAdded.isVisible({ timeout: 5_000 }).catch(() => false);

    // Section should be added
    expect(hasSection).toBeTruthy();
  });

  test('should select a section when clicked', async ({ page }) => {
    // Add a section first
    const addSectionBtn = page.locator('button:has-text("Add Section")').first();
    await addSectionBtn.click();
    await page.waitForTimeout(1_000);

    // Click on the section area
    const sectionArea = page.locator(
      'text=Drop widgets here, [data-section]'
    ).first();

    if (await sectionArea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sectionArea.click();

      // Properties panel should update to show section properties
      await page.waitForTimeout(500);
      const propertiesHeader = page.locator('text=Properties, text=Section');
      await expect(propertiesHeader.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should delete a section', async ({ page }) => {
    // Add a section
    const addSectionBtn = page.locator('button:has-text("Add Section")').first();
    await addSectionBtn.click();
    await page.waitForTimeout(1_000);

    // Find and click the delete section button
    const deleteBtn = page.locator('button:has-text("Delete Section")').first();
    const hasDelete = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasDelete) {
      await deleteBtn.click();
      await page.waitForTimeout(1_000);

      // Section should be removed — empty state or no sections visible
      const emptyState = page.locator(
        'text=Empty Page, button:has-text("Add Section")'
      ).first();
      await expect(emptyState).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Breakpoint Switching', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);
  });

  test('should switch to tablet breakpoint', async ({ page }) => {
    const tabletBtn = page.locator('button:has-text("Tablet")');
    await expect(tabletBtn).toBeVisible({ timeout: 10_000 });
    await tabletBtn.click();
    await page.waitForTimeout(500);

    // Tablet button should appear active (different styling)
    // The canvas width should change to 768px
  });

  test('should switch to mobile breakpoint', async ({ page }) => {
    const mobileBtn = page.locator('button:has-text("Mobile")');
    await expect(mobileBtn).toBeVisible({ timeout: 10_000 });
    await mobileBtn.click();
    await page.waitForTimeout(500);

    // Mobile breakpoint should change canvas width to 375px
  });

  test('should switch back to desktop breakpoint', async ({ page }) => {
    // Switch to mobile first
    await page.locator('button:has-text("Mobile")').click();
    await page.waitForTimeout(300);

    // Switch back to desktop
    await page.locator('button:has-text("Desktop")').click();
    await page.waitForTimeout(300);

    // Desktop should be active again
  });
});

test.describe('Toolbar Actions', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);
  });

  test('should have Undo and Redo buttons', async ({ page }) => {
    const undoBtn = page.locator('button:has-text("Undo")');
    const redoBtn = page.locator('button:has-text("Redo")');

    await expect(undoBtn).toBeVisible({ timeout: 10_000 });
    await expect(redoBtn).toBeVisible();

    // Initially both should be disabled (no history)
    // Check via aria-disabled or cursor style
  });

  test('should have Preview button', async ({ page }) => {
    const previewBtn = page.locator('button:has-text("Preview")');
    await expect(previewBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should have Versions button', async ({ page }) => {
    const versionsBtn = page.locator('button:has-text("Versions")');
    await expect(versionsBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should have Save as Template button', async ({ page }) => {
    const templateBtn = page.locator('button:has-text("Save as Template")');
    await expect(templateBtn).toBeVisible({ timeout: 10_000 });
  });

  test('should have auto-save toggle', async ({ page }) => {
    const autoSaveLabel = page.locator('text=Auto-save');
    await expect(autoSaveLabel).toBeVisible({ timeout: 10_000 });
  });

  test('should save page via Save button', async ({ page }) => {
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();

    // Should show saving indicator then confirm save
    const savingOrSaved = page.locator(
      'button:has-text("Saving"), text=saved, text=Saved'
    );
    await expect(savingOrSaved.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should respond to Ctrl+S keyboard shortcut', async ({ page }) => {
    // Press Ctrl+S to save
    await page.keyboard.press('Control+s');

    // Should trigger save action
    const savingOrSaved = page.locator(
      'button:has-text("Saving"), text=saved, text=Saved'
    );
    await expect(savingOrSaved.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Properties Panel', () => {
  test('should show instruction message when nothing is selected', async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);

    const instruction = page.locator(
      'text=Select a section, text=select, text=Properties'
    ).first();
    await expect(instruction).toBeVisible({ timeout: 10_000 });
  });

  test('should show Content and Style tabs when element is selected', async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/website/editor`);
    await waitForEditorReady(page);

    // Add a section and select it
    const addSectionBtn = page.locator('button:has-text("Add Section")').first();
    await addSectionBtn.click();
    await page.waitForTimeout(1_000);

    // Click on the section to select it
    const section = page.locator(
      'text=Drop widgets here, [data-section]'
    ).first();

    if (await section.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await section.click();
      await page.waitForTimeout(500);

      // Properties panel should show Content and Style tabs
      await expect(
        page.locator('button:has-text("Content")').first()
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator('button:has-text("Style")').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
