/**
 * Regression Runner — orchestrates the full "compare candidate vs baseline" flow
 *
 * Given an agentId, baseline modelId, and candidate modelId, the runner:
 *   1. Loads every active case for the agent
 *   2. For each case:
 *      - Verifies a baseline exists for baseline modelId (fails otherwise)
 *      - Runs the candidate N times (N = REGRESSION_RUNS_PER_CASE)
 *      - Checks candidate for non-determinism across the N captures
 *      - Diffs one candidate capture against the stored baseline signature
 *      - Records a CaseDiff with entries + verdict
 *   3. Aggregates into a RegressionRun and persists it
 *   4. Returns the run for CLI printing
 *
 * Temperature is hard-locked to REGRESSION_TEMPERATURE (0) regardless of
 * what the agent's GM declares, to eliminate noise from the diff.
 */

import crypto from 'crypto';
import {
  REGRESSION_RUNS_PER_CASE,
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type CaseDiff,
  type DiffEntry,
  type DiffVerdict,
  type RegressionCase,
  type RegressionRawArtifact,
  type RegressionRun,
  type ShapeTolerance,
  type SingleShotSignature,
  type ToolCallSignature,
} from '@/types/regression';
import { createRun, listActiveCasesForAgent } from './regression-service';
import {
  diffToolCallSignatures,
  detectToolCallNonDeterminism,
} from './diff/tool-call-diff';
import {
  diffSingleShotSignatures,
  detectSingleShotNonDeterminism,
} from './diff/schema-diff';

export interface CaseExecutor {
  /**
   * Runs one capture of a case against a specific model. Implementations
   * are agent-specific (Copywriter case executor knows how to build a
   * Copywriter system prompt and user message; Jasper case executor knows
   * how to provide tool definitions and a user turn).
   */
  (args: { caseDoc: RegressionCase; modelId: string }): Promise<{
    signature: CaptureSignature;
    rawRequestBody: unknown;
    rawResponseBody: unknown;
  }>;
}

export interface RunnerOptions {
  agentId: string;
  baselineModelId: string;
  candidateModelId: string;
  triggeredBy: string;
  executor: CaseExecutor;
  runsPerCase?: number;
  casesFilter?: (c: RegressionCase) => boolean;
}

function worseVerdict(a: DiffVerdict, b: DiffVerdict): DiffVerdict {
  const rank: Record<DiffVerdict, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function diffCaptures(
  baseline: CaptureSignature,
  candidate: CaptureSignature,
  caseDoc: RegressionCase,
): { entries: DiffEntry[]; verdict: DiffVerdict } {
  if (baseline.kind === 'TOOL_CALLING' && candidate.kind === 'TOOL_CALLING') {
    return diffToolCallSignatures(baseline, candidate);
  }
  if (baseline.kind === 'SINGLE_SHOT' && candidate.kind === 'SINGLE_SHOT') {
    return diffSingleShotSignatures(baseline, candidate, caseDoc.shapeTolerances);
  }
  // Kind mismatch is itself a fail — the baseline was recorded in a
  // different mode than the candidate was captured in.
  return {
    entries: [{
      diffClass: 'SHAPE_DELTA',
      severity: 'FAIL',
      path: 'signature.kind',
      baselineValue: baseline.kind,
      candidateValue: candidate.kind,
      message: `Baseline signature kind=${baseline.kind} does not match candidate kind=${candidate.kind}. Re-record the baseline.`,
    }],
    verdict: 'FAIL',
  };
}

function detectNonDeterminism(
  signatures: CaptureSignature[],
  tolerances?: ShapeTolerance[],
): DiffEntry | null {
  if (signatures.length < 2) {return null;}
  const first = signatures[0];
  if (!first) {return null;}
  if (first.kind === 'TOOL_CALLING') {
    return detectToolCallNonDeterminism(signatures as ToolCallSignature[]);
  }
  return detectSingleShotNonDeterminism(signatures as SingleShotSignature[], tolerances);
}

export async function runRegression(options: RunnerOptions): Promise<RegressionRun> {
  const runId = `regrun_${options.agentId.toLowerCase()}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startedAt = new Date().toISOString();
  const runsPerCase = options.runsPerCase ?? REGRESSION_RUNS_PER_CASE;

  const allCases = await listActiveCasesForAgent(options.agentId);
  const cases = options.casesFilter ? allCases.filter(options.casesFilter) : allCases;
  if (cases.length === 0) {
    throw new Error(
      `[RegressionRunner] No active cases found for agent "${options.agentId}". ` +
      `Seed cases first with scripts/regression-seed-cases.ts.`,
    );
  }

  const caseDiffs: CaseDiff[] = [];
  const rawArtifacts: RegressionRawArtifact[] = [];
  let overallVerdict: DiffVerdict = 'PASS';
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const caseDoc of cases) {
    const baseline = caseDoc.baselines?.[options.baselineModelId];
    if (!baseline) {
      caseDiffs.push({
        caseId: caseDoc.caseId,
        verdict: 'FAIL',
        entries: [{
          diffClass: 'SCHEMA_DELTA',
          severity: 'FAIL',
          path: `baselines.${options.baselineModelId}`,
          baselineValue: null,
          candidateValue: null,
          message:
            `No baseline recorded for model "${options.baselineModelId}" on case "${caseDoc.caseId}". ` +
            `Record one first with regression-record-baseline.ts.`,
        }],
        candidateSignatures: [],
        baselineSignature: {
          kind: 'SINGLE_SHOT',
          schemaValid: false,
          schemaErrors: ['NO_BASELINE'],
          shape: { kind: 'primitive', primitiveType: 'null' },
          invariants: [],
          terminalState: 'PROVIDER_ERROR',
          totalDurationMs: 0,
        },
      });
      failCount += 1;
      overallVerdict = worseVerdict(overallVerdict, 'FAIL');
      continue;
    }

    // Capture candidate N times
    const candidateSignatures: CaptureSignature[] = [];
    let captureError: string | null = null;
    for (let i = 0; i < runsPerCase; i += 1) {
      try {
        const result = await options.executor({ caseDoc, modelId: options.candidateModelId });
        candidateSignatures.push(result.signature);
        rawArtifacts.push({
          caseId: caseDoc.caseId,
          modelId: options.candidateModelId,
          runIndex: i,
          requestBody: result.rawRequestBody,
          responseBody: result.rawResponseBody,
          capturedSignature: result.signature,
          capturedAt: new Date().toISOString(),
          durationMs: signatureDuration(result.signature),
        });
      } catch (err) {
        captureError = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    if (captureError !== null) {
      caseDiffs.push({
        caseId: caseDoc.caseId,
        verdict: 'FAIL',
        entries: [{
          diffClass: 'SCHEMA_DELTA',
          severity: 'FAIL',
          path: 'candidate.capture',
          baselineValue: null,
          candidateValue: null,
          message: `Candidate capture threw: ${captureError}`,
        }],
        candidateSignatures,
        baselineSignature: baseline.signature,
      });
      failCount += 1;
      overallVerdict = worseVerdict(overallVerdict, 'FAIL');
      continue;
    }

    // Non-determinism check across the N captures. Pass the case's shape
    // tolerances so variance inside declared spec range downgrades to WARN
    // instead of FAIL (e.g., Calendar Coordinator schedules naturally drift
    // by a few entries run-to-run on Sonnet 4.6 at temperature 0; if that
    // drift stays inside the spec tolerance the harness reports WARN-for-
    // review rather than hard-blocking an upgrade).
    const nonDetEntry = detectNonDeterminism(candidateSignatures, caseDoc.shapeTolerances);
    const entries: DiffEntry[] = [];
    if (nonDetEntry) {entries.push(nonDetEntry);}

    // Diff the first candidate capture against the baseline
    const firstCandidate = candidateSignatures[0];
    if (firstCandidate) {
      const delta = diffCaptures(baseline.signature, firstCandidate, caseDoc);
      entries.push(...delta.entries);
    }

    const verdict: DiffVerdict = entries.reduce<DiffVerdict>(
      (acc, e) => worseVerdict(acc, e.severity),
      'PASS',
    );
    caseDiffs.push({
      caseId: caseDoc.caseId,
      verdict,
      entries,
      candidateSignatures,
      baselineSignature: baseline.signature,
    });
    if (verdict === 'PASS') {passCount += 1;}
    else if (verdict === 'WARN') {warnCount += 1;}
    else {failCount += 1;}
    overallVerdict = worseVerdict(overallVerdict, verdict);
  }

  const completedAt = new Date().toISOString();
  const run: RegressionRun = {
    runId,
    agentId: options.agentId,
    baselineModelId: options.baselineModelId,
    candidateModelId: options.candidateModelId,
    startedAt,
    completedAt,
    triggeredBy: options.triggeredBy,
    runsPerCase,
    temperature: REGRESSION_TEMPERATURE,
    overallVerdict,
    caseCount: cases.length,
    passCount,
    warnCount,
    failCount,
    caseDiffs,
    rawArtifacts,
  };

  await createRun(run);
  return run;
}

function signatureDuration(sig: CaptureSignature): number {
  return sig.totalDurationMs;
}
