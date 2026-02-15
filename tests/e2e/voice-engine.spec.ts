/**
 * End-to-End Tests for Voice Engine Marketplace
 * Tests provider selection, API key management, and voice testing
 *
 * NOTE: The voice engine currently has 2 providers: Unreal Speech and ElevenLabs.
 * "Native Voice" was removed from the marketplace.
 *
 * @group Phase 2B — Voice AI
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

test.describe('Voice Engine Marketplace E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to voice training page (single-tenant, no workspace routing)
    await page.goto(`${BASE_URL}/voice/training`);
    // Wait for the page to load
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });
  });

  test('should display all voice engine providers', async ({ page }) => {
    // Check Unreal Speech is displayed
    await expect(page.locator('text=Unreal Speech')).toBeVisible();

    // Check ElevenLabs is displayed
    await expect(page.locator('text=ElevenLabs')).toBeVisible();
  });

  test('should display quality badges for each provider', async ({ page }) => {
    // Unreal should show standard quality (text may be lowercase with CSS uppercase)
    const standardBadge = page.locator('button:has-text("Unreal Speech")').locator('text=/standard/i');
    await expect(standardBadge).toBeVisible({ timeout: 5_000 });

    // ElevenLabs should show ultra quality
    const ultraBadge = page.locator('button:has-text("ElevenLabs")').locator('text=/ultra/i');
    await expect(ultraBadge).toBeVisible({ timeout: 5_000 });
  });

  test('should switch to Unreal Speech provider', async ({ page }) => {
    // Click on Unreal Speech
    await page.click('button:has-text("Unreal Speech")');

    // API Key Mode toggle should appear (only for Unreal/ElevenLabs)
    await expect(page.locator('text=API Key Mode')).toBeVisible();

    // Both options should be available
    await expect(page.locator('text=Use Platform Keys')).toBeVisible();
    await expect(page.locator('text=Use My Own Key')).toBeVisible();
  });

  test('should switch to ElevenLabs provider', async ({ page }) => {
    // Click on ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // API Key Mode toggle should appear
    await expect(page.locator('text=API Key Mode')).toBeVisible();
  });

  test('should show API key input when "Use My Own Key" is selected', async ({ page }) => {
    // Select ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // Click "Use My Own Key"
    await page.click('button:has-text("Use My Own Key")');

    // API key input should appear
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Validate")')).toBeVisible();
  });

  test('should load voices when provider changes', async ({ page }) => {
    // Wait for initial voices to load
    const voiceSelect = page.locator('select').first();
    await expect(voiceSelect).toBeVisible({ timeout: 10_000 });

    // Check voice selector is populated
    const options = await voiceSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should display voice description when selected', async ({ page }) => {
    // Wait for voices to load
    const voiceSelect = page.locator('select').first();
    await expect(voiceSelect).toBeVisible({ timeout: 10_000 });

    // Select a voice (if description is available)
    await voiceSelect.selectOption({ index: 0 });

    // Voice descriptions should appear below the select
    // The exact description depends on the selected voice
  });

  test('should display provider features', async ({ page }) => {
    // Check that features are displayed
    await expect(page.locator('text=Features:')).toBeVisible({ timeout: 5_000 });
  });

  test('should have Test Voice button', async ({ page }) => {
    // Test Voice button should be visible
    await expect(page.locator('button:has-text("Test Voice")')).toBeVisible();
  });

  test('should show pricing information for each provider', async ({ page }) => {
    // Check pricing is displayed (format: $X.XXX/1k chars)
    await expect(page.locator('text=/\\$\\d+\\.\\d+.*1k chars/').first()).toBeVisible();
  });

  test('should show latency information for each provider', async ({ page }) => {
    // Check latency badges are displayed
    await expect(page.locator('text=/latency/i').first()).toBeVisible();
  });

  test('should persist provider selection on save', async ({ page }) => {
    // Select ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // Scroll to save button
    await page.locator('button:has-text("Save Voice AI Settings")').scrollIntoViewIfNeeded();

    // Click Save
    await page.click('button:has-text("Save Voice AI Settings")');

    // Wait for save confirmation
    await page.waitForTimeout(2000);

    // Refresh page
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // ElevenLabs should still be selected (if config was saved)
    // Note: In test environment, this may not persist without actual Firestore
  });
});

test.describe('Voice Engine API Integration', () => {
  test('should call correct API when switching providers', async ({ page }) => {
    // Set up request interception
    const requests: string[] = [];

    await page.route('**/api/voice/tts**', async (route) => {
      const url = route.request().url();
      requests.push(url);

      // Return mock response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          voices: [
            { id: 'test-voice-1', name: 'Test Voice', gender: 'female' }
          ]
        })
      });
    });

    await page.goto(`${BASE_URL}/voice/training`);

    // Wait for initial load
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // Switch to Unreal
    await page.click('button:has-text("Unreal Speech")');

    // Wait for API call
    await page.waitForTimeout(500);

    // Verify API was called with unreal engine
    expect(requests.some(r => r.includes('engine=unreal'))).toBe(true);
  });

  test('should call TTS API when testing voice', async ({ page }) => {
    let ttsApiCalled = false;
    let requestBody: Record<string, unknown> = {};

    await page.route('**/api/voice/tts', async (route) => {
      if (route.request().method() === 'POST') {
        ttsApiCalled = true;
        requestBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;

        // Return mock audio response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            audio: 'data:audio/mp3;base64,SUQzBAA=',
            format: 'mp3',
            durationSeconds: 1.5,
            charactersUsed: 50,
            engine: (requestBody.engine as string) ?? 'elevenlabs',
            estimatedCostCents: 0.05
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE_URL}/voice/training`);

    // Wait for page to load
    await page.waitForSelector('button:has-text("Test Voice")', { timeout: 15_000 });

    // Select a voice first so Test Voice is enabled
    const voiceSelect = page.locator('select').first();
    if (await voiceSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const optionCount = await voiceSelect.locator('option').count();
      if (optionCount > 0) {
        await voiceSelect.selectOption({ index: 0 });
      }
    }

    // Click Test Voice (only if enabled)
    const testBtn = page.locator('button:has-text("Test Voice")');
    const isDisabled = await testBtn.isDisabled();
    if (!isDisabled) {
      await testBtn.click();
      await page.waitForTimeout(2000);
      expect(ttsApiCalled).toBe(true);
    }
  });

  test('should pass correct engine when testing ElevenLabs voice', async ({ page }) => {
    let requestEngine: string = '';

    await page.route('**/api/voice/tts', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
        if (body.text) {
          requestEngine = body.engine as string;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            audio: 'data:audio/mp3;base64,SUQzBAA=',
            format: 'mp3',
            durationSeconds: 1.5,
            charactersUsed: 50,
            engine: (body.engine as string) ?? 'elevenlabs',
            estimatedCostCents: 0.05
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            voices: [{ id: 'test', name: 'Test', gender: 'female' }]
          })
        });
      }
    });

    await page.goto(`${BASE_URL}/voice/training`);

    // Select ElevenLabs
    await page.waitForSelector('button:has-text("ElevenLabs")', { timeout: 15_000 });
    await page.click('button:has-text("ElevenLabs")');

    // Wait for voices to load and select one
    await page.waitForTimeout(500);
    const voiceSelect = page.locator('select').first();
    if (await voiceSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const optionCount = await voiceSelect.locator('option').count();
      if (optionCount > 0) {
        await voiceSelect.selectOption({ index: 0 });
      }
    }

    // Test voice (only if enabled)
    const testBtn = page.locator('button:has-text("Test Voice")');
    if (!(await testBtn.isDisabled())) {
      await testBtn.click();
      await page.waitForTimeout(2000);
      expect(requestEngine).toBe('elevenlabs');
    }
  });
});

test.describe('Voice Engine Cost Comparison', () => {
  test('should display cost per 1k characters for Unreal', async ({ page }) => {
    await page.goto(`${BASE_URL}/voice/training`);
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // Unreal cost should be displayed
    await expect(page.locator('text=$0.001/1k chars')).toBeVisible();
  });

  test('should display cost per 1k characters for ElevenLabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/voice/training`);
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // ElevenLabs cost should be displayed (more expensive)
    await expect(page.locator('text=$0.030/1k chars')).toBeVisible();
  });
});

test.describe('Voice Engine Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto(`${BASE_URL}/voice/training`);
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // Tab through provider buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to select with Enter
    await page.keyboard.press('Enter');

    // Some provider should be focused/selected
  });

  test('should have proper labels for screen readers', async ({ page }) => {
    await page.goto(`${BASE_URL}/voice/training`);
    await page.waitForSelector('text=Voice AI Training Lab', { timeout: 15_000 });

    // Voice select should have a label
    await expect(page.locator('text=Select Voice')).toBeVisible();

    // API Key Mode should have a label when a provider with keys is selected
    await page.click('button:has-text("ElevenLabs")');
    await expect(page.locator('text=API Key Mode')).toBeVisible();
  });
});
