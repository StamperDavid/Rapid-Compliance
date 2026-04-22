/**
 * Reseed all 34 Golden Masters with Brand DNA baked into the systemPrompt.
 *
 * Runs each seed-*-gm.js script with --force. Reports the result of each.
 * Fails if ANY script fails.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS = [
  'seed-copywriter-gm.js',
  'seed-video-specialist-gm.js',
  'seed-calendar-coordinator-gm.js',
  'seed-asset-generator-gm.js',
  'seed-seo-expert-gm.js',
  'seed-linkedin-expert-gm.js',
  'seed-tiktok-expert-gm.js',
  'seed-twitter-expert-gm.js',
  'seed-facebook-ads-expert-gm.js',
  'seed-growth-analyst-gm.js',
  'seed-ux-ui-architect-gm.js',
  'seed-funnel-engineer-gm.js',
  'seed-workflow-optimizer-gm.js',
  'seed-email-specialist-gm.js',
  'seed-sms-specialist-gm.js',
  'seed-scraper-specialist-gm.js',
  'seed-competitor-researcher-gm.js',
  'seed-technographic-scout-gm.js',
  'seed-sentiment-analyst-gm.js',
  'seed-trend-scout-gm.js',
  'seed-sales-chat-agent-gm.js',
  'seed-lead-qualifier-gm.js',
  'seed-outreach-specialist-gm.js',
  'seed-merchandiser-gm.js',
  'seed-deal-closer-gm.js',
  'seed-objection-handler-gm.js',
  'seed-review-specialist-gm.js',
  'seed-gmb-specialist-gm.js',
  'seed-review-manager-gm.js',
  'seed-case-study-gm.js',
  'seed-inventory-manager-gm.js',
  'seed-copy-strategist-gm.js',
  'seed-ux-ui-strategist-gm.js',
  'seed-funnel-strategist-gm.js',
  'seed-growth-strategist-gm.js',
  'seed-intent-expander-gm.js',
];

const SCRIPTS_DIR = path.resolve(__dirname);

async function main() {
  // Total includes the Jasper orchestrator GM which lives in the Training Lab
  // `goldenMasters` collection (separate from `specialistGoldenMasters`) and
  // is reseeded via a TypeScript entrypoint.
  const totalCount = SCRIPTS.length + 1;
  console.log(`Reseeding ${totalCount} Golden Masters with Brand DNA baked in...\n`);
  const results = [];
  const startedAt = Date.now();

  for (const script of SCRIPTS) {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    const proc = spawnSync('node', [scriptPath, '--force'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
    });
    const ok = proc.status === 0;
    results.push({ script, ok, stdout: proc.stdout, stderr: proc.stderr });
    const marker = ok ? '✓' : '✗';
    const lastLine = (proc.stdout || '').trim().split('\n').slice(-2, -1)[0] || '';
    console.log(`  ${marker} ${script.padEnd(38)} ${lastLine}`);
    if (!ok) {
      console.log(`    stderr: ${(proc.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    }
  }

  // Reseed Jasper's orchestrator GM (Training Lab collection — different path,
  // TypeScript entrypoint because it imports the live TS prompt files).
  {
    const jasperScript = 'seed-jasper-orchestrator-gm.ts';
    const proc = spawnSync('npx', ['tsx', path.join(SCRIPTS_DIR, jasperScript), '--force'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      shell: true,
    });
    const ok = proc.status === 0;
    results.push({ script: jasperScript, ok, stdout: proc.stdout, stderr: proc.stderr });
    const marker = ok ? '✓' : '✗';
    const lastLine = (proc.stdout || '').trim().split('\n').slice(-2, -1)[0] || '';
    console.log(`  ${marker} ${jasperScript.padEnd(38)} ${lastLine}`);
    if (!ok) {
      console.log(`    stderr: ${(proc.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${passed} ok, ${failed} failed, ${results.length} total (${duration}s)\n`);

  if (failed > 0) {
    console.log('FAILED DETAILS:');
    for (const r of results.filter(x => !x.ok)) {
      console.log(`\n--- ${r.script} ---`);
      console.log(r.stdout);
      console.log(r.stderr);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
