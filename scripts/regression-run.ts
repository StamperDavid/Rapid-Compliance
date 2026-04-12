/**
 * Regression CLI — Run Comparison
 *
 * Compares a candidate model against a recorded baseline on every active
 * case for an agent. Prints a per-case diff report and exits 0 if every
 * case is PASS, 1 if any case has any delta.
 *
 * Usage:
 *   npx tsx scripts/regression-run.ts --agent=COPYWRITER \
 *     --baseline=anthropic/claude-sonnet-4 \
 *     --candidate=anthropic/claude-sonnet-4.6
 *
 * Exit codes:
 *   0 — every case PASS
 *   1 — any case WARN or FAIL
 *   2 — runner itself crashed (no valid run record produced)
 */

import { copywriterExecutor } from '../src/lib/regression/executors/copywriter-executor';
import { videoSpecialistExecutor } from '../src/lib/regression/executors/video-specialist-executor';
import { calendarCoordinatorExecutor } from '../src/lib/regression/executors/calendar-coordinator-executor';
import { assetGeneratorExecutor } from '../src/lib/regression/executors/asset-generator-executor';
import { seoExpertExecutor } from '../src/lib/regression/executors/seo-expert-executor';
import { linkedinExpertExecutor } from '../src/lib/regression/executors/linkedin-expert-executor';
import { tiktokExpertExecutor } from '../src/lib/regression/executors/tiktok-expert-executor';
import { twitterExpertExecutor } from '../src/lib/regression/executors/twitter-expert-executor';
import { facebookAdsExpertExecutor } from '../src/lib/regression/executors/facebook-ads-expert-executor';
import { runRegression, type CaseExecutor } from '../src/lib/regression/runner';
import type { CaseDiff, DiffEntry, RegressionRun } from '../src/types/regression';

const EXECUTOR_REGISTRY: Record<string, CaseExecutor> = {
  COPYWRITER: copywriterExecutor,
  VIDEO_SPECIALIST: videoSpecialistExecutor,
  CALENDAR_COORDINATOR: calendarCoordinatorExecutor,
  ASSET_GENERATOR: assetGeneratorExecutor,
  SEO_EXPERT: seoExpertExecutor,
  LINKEDIN_EXPERT: linkedinExpertExecutor,
  TIKTOK_EXPERT: tiktokExpertExecutor,
  TWITTER_X_EXPERT: twitterExpertExecutor,
  FACEBOOK_ADS_EXPERT: facebookAdsExpertExecutor,
};

interface CliArgs {
  agent: string;
  baseline: string;
  candidate: string;
  triggeredBy: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let agent = '';
  let baseline = '';
  let candidate = '';
  let triggeredBy = 'cli';

  for (const arg of argv) {
    if (arg.startsWith('--agent=')) agent = arg.slice('--agent='.length);
    else if (arg.startsWith('--baseline=')) baseline = arg.slice('--baseline='.length);
    else if (arg.startsWith('--candidate=')) candidate = arg.slice('--candidate='.length);
    else if (arg.startsWith('--triggered-by=')) triggeredBy = arg.slice('--triggered-by='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/regression-run.ts --agent=<ID> --baseline=<model-id> --candidate=<model-id> [--triggered-by=<name>]');
      process.exit(0);
    }
  }

  if (agent === '' || baseline === '' || candidate === '') {
    console.error('Missing required flags. --agent, --baseline, and --candidate are required.');
    process.exit(1);
  }
  return { agent, baseline, candidate, triggeredBy };
}

function printDiffEntry(entry: DiffEntry, indent: string): void {
  const sev = entry.severity === 'FAIL' ? 'FAIL' : entry.severity === 'WARN' ? 'WARN' : 'PASS';
  console.log(`${indent}[${sev}] ${entry.diffClass} @ ${entry.path}`);
  console.log(`${indent}      ${entry.message}`);
  if (entry.baselineValue !== null && entry.baselineValue !== undefined) {
    const bStr = typeof entry.baselineValue === 'string' ? entry.baselineValue : JSON.stringify(entry.baselineValue);
    const cStr = typeof entry.candidateValue === 'string' ? entry.candidateValue : JSON.stringify(entry.candidateValue);
    const bShort = bStr.length > 160 ? bStr.slice(0, 157) + '...' : bStr;
    const cShort = cStr.length > 160 ? cStr.slice(0, 157) + '...' : cStr;
    console.log(`${indent}      baseline:  ${bShort}`);
    console.log(`${indent}      candidate: ${cShort}`);
  }
}

function printCaseDiff(diff: CaseDiff, index: number): void {
  const verdictBadge = diff.verdict === 'PASS' ? '✓ PASS' : diff.verdict === 'WARN' ? '! WARN' : '✗ FAIL';
  console.log(`\n  Case ${index + 1}: ${diff.caseId}  ${verdictBadge}`);
  if (diff.entries.length === 0) {
    console.log('    (no deltas — baseline and candidate matched)');
    return;
  }
  for (const entry of diff.entries) {
    printDiffEntry(entry, '    ');
  }
}

function printRun(run: RegressionRun): void {
  const line = '═'.repeat(72);
  console.log(`\n${line}`);
  console.log(`REGRESSION RUN ${run.runId}`);
  console.log(line);
  console.log(`Agent:         ${run.agentId}`);
  console.log(`Baseline:      ${run.baselineModelId}`);
  console.log(`Candidate:     ${run.candidateModelId}`);
  console.log(`Temperature:   ${run.temperature}`);
  console.log(`Runs per case: ${run.runsPerCase}`);
  console.log(`Started:       ${run.startedAt}`);
  console.log(`Completed:     ${run.completedAt ?? '(crashed)'}`);
  console.log(`Triggered by:  ${run.triggeredBy}`);
  console.log(`\nResults: ${run.passCount} PASS, ${run.warnCount} WARN, ${run.failCount} FAIL (of ${run.caseCount} cases)`);
  console.log(`Overall:       ${run.overallVerdict}`);

  console.log(`\n${'─'.repeat(72)}`);
  console.log('PER-CASE DIFFS');
  console.log('─'.repeat(72));
  run.caseDiffs.forEach((d, i) => printCaseDiff(d, i));

  console.log(`\n${line}`);
  console.log(`Full run record stored in Firestore: regressionRuns/${run.runId}`);
  console.log(line);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const executor = EXECUTOR_REGISTRY[args.agent];
  if (!executor) {
    console.error(`No executor registered for agent "${args.agent}". Known: ${Object.keys(EXECUTOR_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n== Regression Run ==`);
  console.log(`Agent:     ${args.agent}`);
  console.log(`Baseline:  ${args.baseline}`);
  console.log(`Candidate: ${args.candidate}`);
  console.log('\nRunning (this will take a while — 3 runs per case for non-determinism checking)...\n');

  let run: RegressionRun;
  try {
    run = await runRegression({
      agentId: args.agent,
      baselineModelId: args.baseline,
      candidateModelId: args.candidate,
      triggeredBy: args.triggeredBy,
      executor,
    });
  } catch (err) {
    console.error('\nRunner crashed:', err instanceof Error ? err.stack : err);
    process.exit(2);
  }

  printRun(run);

  if (run.overallVerdict === 'FAIL') process.exit(1);
  if (run.overallVerdict === 'WARN') process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nRun script crashed:', err instanceof Error ? err.stack : err);
  process.exit(2);
});
