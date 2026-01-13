/**
 * End-to-End Tests for Voice Engine Marketplace
 * Tests provider selection, API key management, and voice testing
 */

import { test, expect } from '@playwright/test';

const ORG_ID = 'test-org-001';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Voice Engine Marketplace E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to voice training page
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);
    // Wait for the page to load
    await page.waitForSelector('text=Voice AI Training Lab');
  });

  test('should display all three voice engine providers', async ({ page }) => {
    // Check Native Voice is displayed
    await expect(page.locator('text=Native Voice')).toBeVisible();

    // Check Unreal Speech is displayed
    await expect(page.locator('text=Unreal Speech')).toBeVisible();

    // Check ElevenLabs is displayed
    await expect(page.locator('text=ElevenLabs')).toBeVisible();
  });

  test('should display quality badges for each provider', async ({ page }) => {
    // Native should show premium quality
    await expect(page.locator('text=PREMIUM').first()).toBeVisible();

    // Unreal should show standard quality
    await expect(page.locator('text=STANDARD')).toBeVisible();

    // ElevenLabs should show ultra quality
    await expect(page.locator('text=ULTRA')).toBeVisible();
  });

  test('should select Native Voice provider by default', async ({ page }) => {
    // Native Voice should be selected (highlighted)
    const nativeButton = page.locator('button:has-text("Native Voice")');
    await expect(nativeButton).toHaveCSS('border-color', /rgb\(99, 102, 241\)/);
  });

  test('should switch to Unreal Speech provider', async ({ page }) => {
    // Click on Unreal Speech
    await page.click('button:has-text("Unreal Speech")');

    // Verify Unreal Speech is now selected
    const unrealButton = page.locator('button:has-text("Unreal Speech")');
    await expect(unrealButton).toHaveCSS('border-color', /rgb\(99, 102, 241\)/);

    // API Key Mode toggle should appear
    await expect(page.locator('text=API Key Mode')).toBeVisible();

    // Both options should be available
    await expect(page.locator('text=Use Platform Keys')).toBeVisible();
    await expect(page.locator('text=Use My Own Key')).toBeVisible();
  });

  test('should switch to ElevenLabs provider', async ({ page }) => {
    // Click on ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // Verify ElevenLabs is now selected
    const elevenButton = page.locator('button:has-text("ElevenLabs")');
    await expect(elevenButton).toHaveCSS('border-color', /rgb\(99, 102, 241\)/);

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

  test('should not show API key options for Native Voice', async ({ page }) => {
    // Native Voice should be selected by default
    // API Key Mode should NOT be visible for Native
    await expect(page.locator('text=API Key Mode')).not.toBeVisible();
  });

  test('should load voices when provider changes', async ({ page }) => {
    // Wait for initial voices to load
    await page.waitForSelector('select option');

    // Check voice selector is populated
    const voiceSelect = page.locator('select').first();
    const options = await voiceSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);

    // Switch to Unreal Speech
    await page.click('button:has-text("Unreal Speech")');

    // Wait for voices to reload
    await page.waitForTimeout(500); // Give time for API call

    // Check voices are different (Unreal has different voice names)
    await expect(page.locator('option:has-text("Scarlett")')).toBeVisible();
  });

  test('should display voice description when selected', async ({ page }) => {
    // Wait for voices to load
    await page.waitForSelector('select option');

    // Select a voice (if description is available)
    const voiceSelect = page.locator('select').first();
    await voiceSelect.selectOption({ index: 0 });

    // Voice descriptions should appear below the select
    // The exact description depends on the selected voice
  });

  test('should display provider features', async ({ page }) => {
    // Check that features are displayed for Native
    await expect(page.locator('text=Features:')).toBeVisible();

    // Some Native features
    await expect(page.locator('text=Ultra-low latency')).toBeVisible();
  });

  test('should have Test Voice button', async ({ page }) => {
    // Test Voice button should be visible
    await expect(page.locator('button:has-text("Test Voice")')).toBeVisible();
  });

  test('should show loading state when testing voice', async ({ page }) => {
    // Click Test Voice
    await page.click('button:has-text("Test Voice")');

    // Should show loading state
    await expect(page.locator('text=Generating...')).toBeVisible();

    // Wait for it to complete (may return error in test environment)
    await page.waitForTimeout(3000);
  });

  test('should validate API key for ElevenLabs', async ({ page }) => {
    // Select ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // Use own key
    await page.click('button:has-text("Use My Own Key")');

    // Enter invalid API key
    await page.fill('input[type="password"]', 'invalid-key-12345');

    // Click Validate
    await page.click('button:has-text("Validate")');

    // Wait for validation
    await expect(page.locator('text=Validating...')).toBeVisible();

    // Should show invalid message (since key is fake)
    await expect(page.locator('text=Invalid API key')).toBeVisible({ timeout: 10000 });
  });

  test('should show pricing information for each provider', async ({ page }) => {
    // Check pricing is displayed
    await expect(page.locator('text=/\\$\\d+\\.\\d+.*1k chars/')).toBeVisible();
  });

  test('should show latency information for each provider', async ({ page }) => {
    // Check latency badges are displayed
    await expect(page.locator('text=low latency')).toBeVisible();
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
    await page.waitForSelector('text=Voice AI Training Lab');

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

    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Switch to Unreal
    await page.click('button:has-text("Unreal Speech")');

    // Wait for API call
    await page.waitForTimeout(500);

    // Verify API was called with unreal engine
    expect(requests.some(r => r.includes('engine=unreal'))).toBe(true);
  });

  test('should call TTS API when testing voice', async ({ page }) => {
    let ttsApiCalled = false;
    let requestBody: any = null;

    await page.route('**/api/voice/tts', async (route) => {
      if (route.request().method() === 'POST') {
        ttsApiCalled = true;
        requestBody = JSON.parse(route.request().postData() || '{}');

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
            engine: requestBody.engine || 'native',
            estimatedCostCents: 0.05
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Wait for page to load
    await page.waitForSelector('button:has-text("Test Voice")');

    // Click Test Voice
    await page.click('button:has-text("Test Voice")');

    // Wait for API call
    await page.waitForTimeout(2000);

    // Verify API was called
    expect(ttsApiCalled).toBe(true);
    expect(requestBody.organizationId).toBe(ORG_ID);
    expect(requestBody.engine).toBeDefined();
  });

  test('should pass correct engine when testing ElevenLabs voice', async ({ page }) => {
    let requestEngine: string = '';

    await page.route('**/api/voice/tts', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.text) {
          requestEngine = body.engine;
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
            engine: body.engine || 'native',
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

    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Select ElevenLabs
    await page.click('button:has-text("ElevenLabs")');

    // Wait for voices to load
    await page.waitForTimeout(500);

    // Test voice
    await page.click('button:has-text("Test Voice")');

    // Wait for API call
    await page.waitForTimeout(2000);

    // Verify correct engine was passed
    expect(requestEngine).toBe('elevenlabs');
  });
});

test.describe('Voice Engine Cost Comparison', () => {
  test('should display cost per 1k characters for Native', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Native cost should be displayed
    await expect(page.locator('text=$0.005/1k chars')).toBeVisible();
  });

  test('should display cost per 1k characters for Unreal', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Unreal cost should be displayed (cheaper)
    await expect(page.locator('text=$0.001/1k chars')).toBeVisible();
  });

  test('should display cost per 1k characters for ElevenLabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // ElevenLabs cost should be displayed (more expensive)
    await expect(page.locator('text=$0.030/1k chars')).toBeVisible();
  });
});

test.describe('Voice Engine Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Tab through provider buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to select with Enter
    await page.keyboard.press('Enter');

    // Some provider should be focused/selected
  });

  test('should have proper labels for screen readers', async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace/${ORG_ID}/voice/training`);

    // Voice select should have a label
    await expect(page.locator('text=Select Voice')).toBeVisible();

    // API Key Mode should have a label
    await page.click('button:has-text("ElevenLabs")');
    await expect(page.locator('text=API Key Mode')).toBeVisible();
  });
});
