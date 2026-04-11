/**
 * Regression CLI — Inspect a Stored Run
 *
 * Loads a past RegressionRun from Firestore and prints its full report.
 * Useful for after-the-fact review or for comparing multiple runs.
 *
 * Usage:
 *   npx tsx scripts/regression-inspect.ts --runId=regrun_copywriter_1760000000_abc123
 */

import { getRun } from '../src/lib/regression/regression-service';
import type { CaseDiff, DiffEntry, RegressionRun } from '../src/types/regression';

function parseArgs(): { runId: string } {
  const argv = process.argv.slice(2);
  let runId = '';
  for (const arg of argv) {
    if (arg.startsWith('--runId=')) runId = arg.slice('--runId='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/regression-inspect.ts --runId=<runId>');
      process.exit(0);
    }
  }
  if (runId === '') {
    console.error('Missing --runId flag.');
    process.exit(1);
  }
  return { runId };
}

function printEntry(entry: DiffEntry, indent: string): void {
  console.log(`${indent}[${entry.severity}] ${entry.diffClass} @ ${entry.path}`);
  console.log(`${indent}      ${entry.message}`);
}

function printCase(diff: CaseDiff, i: number): void {
  const badge = diff.verdict === 'PASS' ? '✓' : diff.verdict === 'WARN' ? '!' : '✗';
  console.log(`\n  ${badge} ${diff.caseId}  [${diff.verdict}]`);
  if (diff.entries.length === 0) {
    console.log('    (no deltas)');
    return;
  }
  diff.entries.forEach((e) => printEntry(e, '    '));
}

function printRun(run: RegressionRun): void {
  const line = '═'.repeat(72);
  console.log(`\n${line}`);
  console.log(`RUN ${run.runId}`);
  console.log(line);
  console.log(`Agent:         ${run.agentId}`);
  console.log(`Baseline:      ${run.baselineModelId}`);
  console.log(`Candidate:     ${run.candidateModelId}`);
  console.log(`Started:       ${run.startedAt}`);
  console.log(`Completed:     ${run.completedAt ?? '(crashed)'}`);
  console.log(`Triggered by:  ${run.triggeredBy}`);
  console.log(`Results:       ${run.passCount} PASS / ${run.warnCount} WARN / ${run.failCount} FAIL of ${run.caseCount}`);
  console.log(`Overall:       ${run.overallVerdict}`);
  console.log(`\nPER-CASE DIFFS`);
  run.caseDiffs.forEach((d, i) => printCase(d, i));
  console.log('');
}

async function main(): Promise<void> {
  const { runId } = parseArgs();
  const run = await getRun(runId);
  if (!run) {
    console.error(`Run "${runId}" not found.`);
    process.exit(1);
  }
  printRun(run);
  process.exit(0);
}

main().catch((err) => {
  console.error('Inspect script crashed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
