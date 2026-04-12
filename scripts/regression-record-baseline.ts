/**
 * Regression CLI — Record Baseline
 *
 * Captures the current behavior of an agent on every active case and stores
 * it as the baseline for a specific model id. Future regression runs will
 * diff candidate behavior against this baseline.
 *
 * Usage:
 *   npx tsx scripts/regression-record-baseline.ts --agent=COPYWRITER --model=anthropic/claude-sonnet-4
 *   npx tsx scripts/regression-record-baseline.ts --agent=COPYWRITER --model=anthropic/claude-sonnet-4 --overwrite-baseline
 *
 * Exit codes:
 *   0 — all cases recorded successfully
 *   1 — one or more cases failed to capture
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
import { growthAnalystExecutor } from '../src/lib/regression/executors/growth-analyst-executor';
import {
  listActiveCasesForAgent,
  recordBaseline,
  buildBaseline,
} from '../src/lib/regression/regression-service';
import { REGRESSION_RUNS_PER_CASE } from '../src/types/regression';
import type { CaseExecutor } from '../src/lib/regression/runner';

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
  GROWTH_ANALYST: growthAnalystExecutor,
};

interface CliArgs {
  agent: string;
  modelId: string;
  overwrite: boolean;
  triggeredBy: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let agent = '';
  let modelId = '';
  let overwrite = false;
  let triggeredBy = 'cli';

  for (const arg of argv) {
    if (arg.startsWith('--agent=')) agent = arg.slice('--agent='.length);
    else if (arg.startsWith('--model=')) modelId = arg.slice('--model='.length);
    else if (arg === '--overwrite-baseline') overwrite = true;
    else if (arg.startsWith('--triggered-by=')) triggeredBy = arg.slice('--triggered-by='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/regression-record-baseline.ts --agent=<ID> --model=<openrouter-model-id> [--overwrite-baseline] [--triggered-by=<name>]');
      process.exit(0);
    }
  }

  if (agent === '' || modelId === '') {
    console.error('Missing required flags. --agent=<ID> and --model=<openrouter-model-id> are required.');
    process.exit(1);
  }
  return { agent, modelId, overwrite, triggeredBy };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const executor = EXECUTOR_REGISTRY[args.agent];
  if (!executor) {
    console.error(`No executor registered for agent "${args.agent}". Known: ${Object.keys(EXECUTOR_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n== Regression Baseline Recording ==`);
  console.log(`Agent:         ${args.agent}`);
  console.log(`Model:         ${args.modelId}`);
  console.log(`Overwrite:     ${args.overwrite}`);
  console.log(`Temperature:   0 (harness-locked)`);
  console.log(`Runs/case:     1 (baseline is a single capture)`);
  console.log('');

  const cases = await listActiveCasesForAgent(args.agent);
  if (cases.length === 0) {
    console.error(`No active cases for agent "${args.agent}". Seed cases first with scripts/regression-seed-cases.ts.`);
    process.exit(1);
  }
  console.log(`Found ${cases.length} active cases.\n`);

  let ok = 0;
  let failed = 0;

  for (const c of cases) {
    const started = Date.now();
    process.stdout.write(`  [${c.caseId}] ${c.name} ... `);
    try {
      const result = await executor({ caseDoc: c, modelId: args.modelId });
      const baseline = buildBaseline(
        args.modelId,
        args.triggeredBy,
        result.signature,
        [],
        `Baseline recorded via CLI at ${new Date().toISOString()}`,
      );
      await recordBaseline(c.caseId, baseline, args.overwrite);
      const ms = Date.now() - started;
      console.log(`ok (${ms}ms, ${describeSignature(result.signature)})`);
      ok += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${msg}`);
      failed += 1;
    }
  }

  console.log(`\nRecorded ${ok}/${cases.length} baselines. ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

function describeSignature(sig: { kind: string; stepCount?: number; schemaValid?: boolean; terminalState: string }): string {
  if (sig.kind === 'TOOL_CALLING') {
    return `${sig.stepCount ?? 0} steps, terminal=${sig.terminalState}`;
  }
  return `schemaValid=${sig.schemaValid ?? false}, terminal=${sig.terminalState}`;
}

// Runs-per-case constant is referenced for symmetry with compare script; keep
// import live so the intent of the harness is discoverable from the CLI file.
void REGRESSION_RUNS_PER_CASE;

main().catch((err) => {
  console.error('\nBaseline recording crashed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
