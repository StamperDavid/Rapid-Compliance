/**
 * Playwright Auth Teardown
 *
 * Cleans up auth state files after test run.
 * Paired with auth.setup.ts via playwright.config.ts project teardown.
 */

import { test as teardown } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '.auth');

teardown('clean up auth state files', () => {
  const files = ['user.json', 'admin.json'];
  for (const file of files) {
    const filePath = path.join(authDir, file);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }));
      console.info(`[auth.teardown] Reset ${file}`);
    }
  }
});
