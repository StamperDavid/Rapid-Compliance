/**
 * TypeScript Check Runner (Windows-safe)
 *
 * Runs `tsc --noEmit` via Node.js directly to avoid
 * the npx exit-code bug on Windows where npx returns 1 even
 * when tsc produces zero errors.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const tscJs = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
const cwd = path.join(__dirname, '..');

try {
  const output = execFileSync(process.execPath, [tscJs, '--noEmit'], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (output && output.trim()) {
    process.stdout.write(output);
  }
  // Success — natural exit with code 0
} catch (error) {
  // execFileSync throws if the child exits non-zero (real TS errors).
  const stdout = error.stdout ? error.stdout.toString() : '';
  const stderr = error.stderr ? error.stderr.toString() : '';
  if (stdout.trim()) { process.stdout.write(stdout); }
  if (stderr.trim()) { process.stderr.write(stderr); }
  process.exitCode = error.status || 1;
}
