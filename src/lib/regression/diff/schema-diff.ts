/**
 * Schema Diff — compares two SingleShotSignatures (JSON shape + invariants)
 *
 * Delta classes:
 *   SCHEMA_DELTA    — one signature validated and the other did not
 *   SHAPE_DELTA     — structural shape of the parsed JSON differs
 *   INVARIANT_DELTA — candidate violates an invariant the baseline passed
 *   TERMINAL_DELTA  — different terminal states
 */

import type {
  SingleShotSignature,
  JsonShape,
  DiffEntry,
  DiffVerdict,
  ShapeTolerance,
} from '@/types/regression';

export interface SchemaDiffResult {
  entries: DiffEntry[];
  verdict: DiffVerdict;
}

function worseVerdict(a: DiffVerdict, b: DiffVerdict): DiffVerdict {
  const rank: Record<DiffVerdict, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Look up a tolerance rule matching `path` and check if both values fall
 * inside the allowed range. Returns the matched tolerance if both are in
 * range (so the caller can downgrade severity), or null otherwise.
 */
function findArrayLengthTolerance(
  path: string,
  baselineLength: number,
  candidateLength: number,
  tolerances: ShapeTolerance[] | undefined,
): ShapeTolerance | null {
  if (!tolerances) {return null;}
  for (const t of tolerances) {
    if (t.kind !== 'arrayLength') {continue;}
    if (t.path !== path) {continue;}
    if (baselineLength >= t.min && baselineLength <= t.max
        && candidateLength >= t.min && candidateLength <= t.max) {
      return t;
    }
  }
  return null;
}

/**
 * Walk two JsonShape trees in parallel and report every structural delta.
 * Reports deltas at the most specific path so a reader sees "sections[2]
 * lost its cta field" rather than "something in sections changed."
 */
export function diffJsonShape(
  baseline: JsonShape,
  candidate: JsonShape,
  path: string,
  out: DiffEntry[],
  tolerances?: ShapeTolerance[],
): void {
  if (baseline.kind !== candidate.kind) {
    out.push({
      diffClass: 'SHAPE_DELTA',
      severity: 'FAIL',
      path,
      baselineValue: baseline.kind,
      candidateValue: candidate.kind,
      message: `Shape kind changed at ${path}: ${baseline.kind} -> ${candidate.kind}`,
    });
    return;
  }

  if (baseline.kind === 'primitive' && candidate.kind === 'primitive') {
    if (baseline.primitiveType !== candidate.primitiveType) {
      out.push({
        diffClass: 'SHAPE_DELTA',
        severity: 'WARN',
        path,
        baselineValue: baseline.primitiveType,
        candidateValue: candidate.primitiveType,
        message: `Primitive type changed at ${path}: ${baseline.primitiveType} -> ${candidate.primitiveType}`,
      });
    }
    return;
  }

  if (baseline.kind === 'array' && candidate.kind === 'array') {
    if (baseline.length !== candidate.length) {
      const lengthPath = `${path}.length`;
      const tolerance = findArrayLengthTolerance(
        lengthPath,
        baseline.length,
        candidate.length,
        tolerances,
      );
      if (tolerance !== null) {
        out.push({
          diffClass: 'SHAPE_DELTA',
          severity: 'WARN',
          path: lengthPath,
          baselineValue: baseline.length,
          candidateValue: candidate.length,
          message:
            `Array length changed at ${path}: ${baseline.length} -> ${candidate.length}. ` +
            `Both values inside declared tolerance [${tolerance.min}..${tolerance.max}]${ 
            tolerance.reason ? ` — ${tolerance.reason}` : '' 
            }. Downgraded to WARN.`,
        });
      } else {
        out.push({
          diffClass: 'SHAPE_DELTA',
          severity: 'FAIL',
          path: lengthPath,
          baselineValue: baseline.length,
          candidateValue: candidate.length,
          message: `Array length changed at ${path}: ${baseline.length} -> ${candidate.length}`,
        });
      }
    }
    const minLen = Math.min(baseline.length, candidate.length);
    for (let i = 0; i < minLen; i += 1) {
      const bItem = baseline.itemShapes[i];
      const cItem = candidate.itemShapes[i];
      if (bItem && cItem) {
        diffJsonShape(bItem, cItem, `${path}[${i}]`, out, tolerances);
      }
    }
    return;
  }

  if (baseline.kind === 'object' && candidate.kind === 'object') {
    const baselineKeys = new Set(baseline.keys);
    const candidateKeys = new Set(candidate.keys);
    const removed = baseline.keys.filter((k) => !candidateKeys.has(k));
    const added = candidate.keys.filter((k) => !baselineKeys.has(k));
    if (removed.length > 0 || added.length > 0) {
      out.push({
        diffClass: 'SHAPE_DELTA',
        severity: 'FAIL',
        path: `${path}.keys`,
        baselineValue: baseline.keys,
        candidateValue: candidate.keys,
        message:
          `Object keys changed at ${path}. ` +
          `Added: [${added.join(', ') || '(none)'}]. ` +
          `Removed: [${removed.join(', ') || '(none)'}].`,
      });
    }
    // Recurse into fields that exist in both
    for (const key of baseline.keys) {
      if (candidateKeys.has(key)) {
        const bField = baseline.fields[key];
        const cField = candidate.fields[key];
        if (bField && cField) {
          diffJsonShape(bField, cField, `${path}.${key}`, out, tolerances);
        }
      }
    }
  }
}

export function diffSingleShotSignatures(
  baseline: SingleShotSignature,
  candidate: SingleShotSignature,
  tolerances?: ShapeTolerance[],
): SchemaDiffResult {
  const entries: DiffEntry[] = [];
  let verdict: DiffVerdict = 'PASS';

  // ---- Terminal state
  if (baseline.terminalState !== candidate.terminalState) {
    entries.push({
      diffClass: 'TERMINAL_DELTA',
      severity: 'FAIL',
      path: 'terminalState',
      baselineValue: baseline.terminalState,
      candidateValue: candidate.terminalState,
      message: `Terminal state changed: ${baseline.terminalState} -> ${candidate.terminalState}`,
    });
    verdict = worseVerdict(verdict, 'FAIL');
  }

  // ---- Schema validity
  if (baseline.schemaValid !== candidate.schemaValid) {
    entries.push({
      diffClass: 'SCHEMA_DELTA',
      severity: 'FAIL',
      path: 'schemaValid',
      baselineValue: baseline.schemaValid,
      candidateValue: candidate.schemaValid,
      message: candidate.schemaValid
        ? 'Baseline failed schema validation but candidate passed (baseline was corrupted)'
        : `Candidate failed schema validation: ${candidate.schemaErrors.join('; ')}`,
    });
    verdict = worseVerdict(verdict, 'FAIL');
  }

  // ---- JSON shape (only meaningful when both parsed)
  if (baseline.schemaValid || candidate.schemaValid) {
    const shapeEntries: DiffEntry[] = [];
    diffJsonShape(baseline.shape, candidate.shape, '$', shapeEntries, tolerances);
    for (const entry of shapeEntries) {
      entries.push(entry);
      verdict = worseVerdict(verdict, entry.severity);
    }
  }

  // ---- Invariants
  const baselineInvariants = new Map(baseline.invariants.map((i) => [i.id, i]));
  const candidateInvariants = new Map(candidate.invariants.map((i) => [i.id, i]));
  const allIds = new Set([...baselineInvariants.keys(), ...candidateInvariants.keys()]);
  for (const id of allIds) {
    const b = baselineInvariants.get(id);
    const c = candidateInvariants.get(id);
    if (!b || !c) {continue;} // invariant set mismatch is a definition-time problem, not a diff
    if (b.passed !== c.passed) {
      // Candidate pass + baseline fail → WARN (baseline suspected broken).
      // Candidate fail + baseline pass → defaults to FAIL, but invariants
      // can declare severityOnFail='WARN' to downgrade to review-only.
      const severity: DiffVerdict = c.passed
        ? 'WARN'
        : (c.severityOnFail ?? 'FAIL');
      entries.push({
        diffClass: 'INVARIANT_DELTA',
        severity,
        path: `invariants.${id}`,
        baselineValue: b.passed,
        candidateValue: c.passed,
        message: c.passed
          ? `Invariant "${id}" now passes on candidate (was failing on baseline — check if baseline was recorded on a broken run)`
          : `Invariant "${id}" failed on candidate: ${c.message ?? 'no detail'}`,
      });
      verdict = worseVerdict(verdict, severity);
    }
  }

  return { entries, verdict };
}

/**
 * Non-determinism check for single-shot mode. Any two candidate signatures
 * that differ structurally is a FAIL — the model produced unstable output
 * on identical input at temperature 0.
 */
export function detectSingleShotNonDeterminism(
  candidates: SingleShotSignature[],
): DiffEntry | null {
  if (candidates.length < 2) {return null;}
  const [first, ...rest] = candidates;
  if (!first) {return null;}
  for (const other of rest) {
    const delta = diffSingleShotSignatures(first, other);
    if (delta.entries.length > 0) {
      return {
        diffClass: 'NON_DETERMINISM',
        severity: 'FAIL',
        path: 'candidate.runs[*]',
        baselineValue: { schemaValid: first.schemaValid },
        candidateValue: { schemaValid: other.schemaValid },
        message:
          `Candidate produced non-deterministic output across repeat runs on identical input. ` +
          `First delta: ${delta.entries[0]?.message ?? 'n/a'}`,
      };
    }
  }
  return null;
}
