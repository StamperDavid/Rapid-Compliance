/**
 * Test Account Configuration
 *
 * Credentials are loaded from environment variables.
 * Set these in .env.test or pass them when running tests:
 *
 *   E2E_USER_EMAIL=test@salesvelocity.ai \
 *   E2E_USER_PASSWORD=TestPass123! \
 *   E2E_ADMIN_EMAIL=admin@salesvelocity.ai \
 *   E2E_ADMIN_PASSWORD=AdminPass123! \
 *   npx playwright test
 */

export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? 'e2e-member@salesvelocity.ai',
  password: process.env.E2E_USER_PASSWORD ?? 'E2eTestPass!2026',
  role: 'member' as const,
  displayName: 'E2E Test User',
};

export const TEST_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@salesvelocity.ai',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdminPass!2026',
  role: 'admin' as const,
  displayName: 'E2E Admin User',
};

export const TEST_MANAGER = {
  email: process.env.E2E_MANAGER_EMAIL ?? 'e2e-manager@salesvelocity.ai',
  password: process.env.E2E_MANAGER_PASSWORD ?? 'E2eManagerPass!2026',
  role: 'manager' as const,
  displayName: 'E2E Manager User',
};

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
