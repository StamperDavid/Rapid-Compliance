/**
 * Auth Teardown — Runs after all tests complete
 *
 * Cleans up saved auth state files.
 */

import { test as teardown } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '../.auth');

teardown('clean up auth state', () => {
  // Remove saved auth state files
  const files = ['user.json', 'admin.json'];
  for (const file of files) {
    const filePath = path.join(authDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
