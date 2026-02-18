/**
 * Wrapper for lint-staged that handles the "no matching files" exit code.
 * lint-staged v16 exits with code 1 when no staged files match the
 * configured globs (e.g., committing only .md files when config targets
 * *.{ts,tsx}). This wrapper treats that case as success.
 */

const { execSync } = require('child_process');

try {
  execSync('npx lint-staged', { stdio: 'pipe' });
} catch (e) {
  const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
  if (output.includes('could not find any staged files')) {
    console.log('No staged .ts/.tsx files to lint — OK');
    process.exit(0);
  }
  // Real lint failure — show output and fail
  if (e.stdout) { process.stdout.write(e.stdout); }
  if (e.stderr) { process.stderr.write(e.stderr); }
  process.exit(1);
}
