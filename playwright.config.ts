import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration
 * E2E testing setup with auth state management
 *
 * Usage:
 *   npm run test:playwright          — Run all tests headless
 *   npm run test:playwright:ui       — Interactive UI mode
 *   npx playwright test --headed     — Run with visible browser
 *   npx playwright test auth-login   — Run specific test file
 */

const authFile = path.join(__dirname, 'tests/e2e/.auth/user.json');
const adminAuthFile = path.join(__dirname, 'tests/e2e/.auth/admin.json');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // --- Auth Setup (runs first) ---
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      teardown: 'auth-cleanup',
    },
    {
      name: 'auth-cleanup',
      testMatch: /auth\.teardown\.ts/,
    },

    // --- Unauthenticated Tests (no setup dependency) ---
    {
      name: 'no-auth',
      testMatch: /auth-(login|signup)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // --- Authenticated Tests (depend on auth setup) ---
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['auth-setup'],
      testIgnore: [
        /auth-(login|signup)\.spec\.ts/,
        /auth-rbac\.spec\.ts/,
      ],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['auth-setup'],
      testIgnore: [
        /auth-(login|signup)\.spec\.ts/,
        /auth-rbac\.spec\.ts/,
      ],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['auth-setup'],
      testIgnore: [
        /auth-(login|signup)\.spec\.ts/,
        /auth-rbac\.spec\.ts/,
      ],
    },

    // --- RBAC tests need their own auth handling ---
    {
      name: 'rbac',
      testMatch: /auth-rbac\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // --- Mobile (authenticated) ---
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: authFile,
      },
      dependencies: ['auth-setup'],
      testIgnore: [
        /auth-(login|signup|rbac|session)\.spec\.ts/,
      ],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: authFile,
      },
      dependencies: ['auth-setup'],
      testIgnore: [
        /auth-(login|signup|rbac|session)\.spec\.ts/,
      ],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
