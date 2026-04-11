/**
 * Tool-Call Diff — compares two ToolCallSignatures and produces diff entries
 *
 * Given a baseline signature and a candidate signature from the same case,
 * walks the tool-call sequences step-by-step and reports every delta class:
 *
 *   STEP_COUNT_DELTA  — sequences are different lengths
 *   TOOL_SET_DELTA    — sets of tools called differ (added/removed tools)
 *   ORDER_DELTA       — same tool set, different order
 *   ARG_SHAPE_DELTA   — same tool, different argument key shape
 *   TERMINAL_DELTA    — different terminal states
 *
 * Worst-severity across all entries becomes the case verdict (FAIL > WARN > PASS).
 * The diff never auto-promotes — the owner reviews the report and decides.
 */

import type {
  ToolCallSignature,
  DiffEntry,
  DiffVerdict,
} from '@/types/regression';

export interface ToolCallDiffResult {
  entries: DiffEntry[];
  verdict: DiffVerdict;
}

function worseVerdict(a: DiffVerdict, b: DiffVerdict): DiffVerdict {
  const rank: Record<DiffVerdict, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Compare a candidate tool-call signature against the baseline. Returns
 * every delta found and an overall verdict. An empty entries array means
 * the candidate matched the baseline step-for-step.
 */
export function diffToolCallSignatures(
  baseline: ToolCallSignature,
  candidate: ToolCallSignature,
): ToolCallDiffResult {
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
      message: `Chain terminated differently: baseline=${baseline.terminalState}, candidate=${candidate.terminalState}`,
    });
    verdict = worseVerdict(verdict, 'FAIL');
  }

  // ---- Step count
  if (baseline.stepCount !== candidate.stepCount) {
    entries.push({
      diffClass: 'STEP_COUNT_DELTA',
      severity: 'FAIL',
      path: 'stepCount',
      baselineValue: baseline.stepCount,
      candidateValue: candidate.stepCount,
      message: `Tool call count differs: baseline=${baseline.stepCount} steps, candidate=${candidate.stepCount} steps`,
    });
    verdict = worseVerdict(verdict, 'FAIL');
  }

  // ---- Tool set (what was called, regardless of order)
  const baselineToolSet = new Set(baseline.steps.map((s) => s.toolName));
  const candidateToolSet = new Set(candidate.steps.map((s) => s.toolName));
  const addedTools = [...candidateToolSet].filter((t) => !baselineToolSet.has(t));
  const removedTools = [...baselineToolSet].filter((t) => !candidateToolSet.has(t));
  if (addedTools.length > 0 || removedTools.length > 0) {
    entries.push({
      diffClass: 'TOOL_SET_DELTA',
      severity: 'FAIL',
      path: 'steps[*].toolName',
      baselineValue: [...baselineToolSet].sort(),
      candidateValue: [...candidateToolSet].sort(),
      message:
        `Different tools called. ` +
        `Added by candidate: [${addedTools.join(', ') || '(none)'}]. ` +
        `Removed by candidate: [${removedTools.join(', ') || '(none)'}].`,
    });
    verdict = worseVerdict(verdict, 'FAIL');
  }

  // ---- Per-step comparison up to the shorter sequence length
  const minLen = Math.min(baseline.steps.length, candidate.steps.length);
  for (let i = 0; i < minLen; i += 1) {
    const bStep = baseline.steps[i];
    const cStep = candidate.steps[i];

    // ORDER_DELTA: same tool set already confirmed above, but at this specific
    // index the names differ. Only flag if the names actually differ — if
    // they match we still need to check arg shape below.
    if (bStep.toolName !== cStep.toolName) {
      // If this tool exists somewhere in the other sequence, it's an order swap.
      const bHasCandidateTool = baseline.steps.some((s) => s.toolName === cStep.toolName);
      const cHasBaselineTool = candidate.steps.some((s) => s.toolName === bStep.toolName);
      if (bHasCandidateTool && cHasBaselineTool) {
        entries.push({
          diffClass: 'ORDER_DELTA',
          severity: 'FAIL',
          path: `steps[${i}].toolName`,
          baselineValue: bStep.toolName,
          candidateValue: cStep.toolName,
          message: `Same tool set but wrong order at step ${i}: baseline called ${bStep.toolName}, candidate called ${cStep.toolName}`,
        });
        verdict = worseVerdict(verdict, 'FAIL');
      }
      // If it's not an order swap, TOOL_SET_DELTA above already captured it.
      continue; // can't compare arg shapes across different tools
    }

    // Same tool at this index — compare argument key shapes
    if (bStep.argKeyShapeHash !== cStep.argKeyShapeHash) {
      entries.push({
        diffClass: 'ARG_SHAPE_DELTA',
        severity: 'WARN',
        path: `steps[${i}].argKeys`,
        baselineValue: bStep.argKeys,
        candidateValue: cStep.argKeys,
        message:
          `Same tool ${bStep.toolName} at step ${i} but different argument keys. ` +
          `Baseline: [${bStep.argKeys.join(', ')}], candidate: [${cStep.argKeys.join(', ')}]`,
      });
      verdict = worseVerdict(verdict, 'WARN');
    }
  }

  return { entries, verdict };
}

/**
 * Given multiple candidate captures (N=3) check for non-determinism —
 * any two candidate signatures that differ from each other indicates the
 * candidate model produced non-deterministic output on identical input.
 */
export function detectToolCallNonDeterminism(
  candidates: ToolCallSignature[],
): DiffEntry | null {
  if (candidates.length < 2) {return null;}
  const [first, ...rest] = candidates;
  if (!first) {return null;}
  for (const other of rest) {
    const delta = diffToolCallSignatures(first, other);
    if (delta.entries.length > 0) {
      return {
        diffClass: 'NON_DETERMINISM',
        severity: 'FAIL',
        path: 'candidate.runs[*]',
        baselineValue: { stepCount: first.stepCount, steps: first.steps.map((s) => s.toolName) },
        candidateValue: { stepCount: other.stepCount, steps: other.steps.map((s) => s.toolName) },
        message:
          `Candidate produced non-deterministic tool sequences across repeat runs on the same input. ` +
          `First run: ${first.stepCount} steps, later run: ${other.stepCount} steps. ` +
          `First delta: ${delta.entries[0]?.message ?? 'n/a'}`,
      };
    }
  }
  return null;
}
