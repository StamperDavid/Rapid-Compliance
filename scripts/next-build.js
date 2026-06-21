#!/usr/bin/env node
/**
 * Build wrapper — fixes a Windows-only `next build` failure.
 *
 * Webpack's filesystem scan during `next build` globs the system temp root
 * (`%TEMP%`). On Windows that folder contains permission-protected OS folders
 * (e.g. `%TEMP%\WinSAT`); `scandir` on them throws `EPERM: operation not
 * permitted`, which webpack surfaces as a compile error and the whole build
 * fails. (A one-off `watchOptions.ignored` patch in next.config.js targeted an
 * earlier offending temp folder but didn't generalize.)
 *
 * The robust fix: on Windows ONLY, point the build's temp dir at a clean,
 * project-local `.buildtmp/` folder that contains no protected OS directories,
 * so the glob can't trip over them. No-op on Linux/macOS (incl. Vercel), so the
 * production deploy build is completely unchanged.
 *
 * NODE_OPTIONS (e.g. --max-old-space-size) is inherited from the caller's env.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = { ...process.env };

if (process.platform === 'win32') {
  const tmpDir = path.join(process.cwd(), '.buildtmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  env.TEMP = tmpDir;
  env.TMP = tmpDir;
  env.TMPDIR = tmpDir;
  console.log(`[next-build] Windows: build temp redirected to ${tmpDir}`);
}

const nextBin = require.resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env,
});

process.exit(result.status === null ? 1 : result.status);
