/**
 * Model Regression Harness — Type Definitions
 *
 * Backs the guardrail that prevents silent model swaps from changing agent
 * behavior without owner approval. Every model upgrade (e.g. Sonnet 4 →
 * Sonnet 4.6) must compare a candidate against a baseline on a curated set
 * of canned inputs before going live.
 *
 * Two comparison modes:
 *   TOOL_CALLING — for agents like Jasper that issue a sequence of tool calls.
 *                  Captures step count, tool names, argument key shapes, and
 *                  terminal state. Used to answer "does a 13-step orchestration
 *                  still produce the same 13 steps on the new model?"
 *   SINGLE_SHOT  — for specialists like Copywriter that return a single JSON
 *                  blob. Captures schema validity, structural shape, and
 *                  specialist-declared invariants.
 */

// ============================================================================
// CASE DEFINITION — what you run against a model
// ============================================================================

export type RegressionMode = 'TOOL_CALLING' | 'SINGLE_SHOT';

/**
 * Declares that a specific path in a single-shot output is allowed to vary
 * within a spec-defined range. The diff engine uses this to downgrade
 * in-range length deltas from FAIL to WARN — the model is still reported
 * as different, but the difference is known to be inside the spec and does
 * not by itself block an upgrade.
 */
export interface ShapeTolerance {
  path: string;                       // exact path as emitted by the diff engine (e.g. '$.sections.length')
  kind: 'arrayLength';                // only supported kind today
  min: number;
  max: number;
  reason?: string;                    // human note explaining the spec range
}

/**
 * A single test case. Stored in Firestore so the corpus is owner-curated, not
 * code-committed. Cases are authored once and reused every time a model
 * upgrade is proposed.
 */
export interface RegressionCase {
  caseId: string;
  agentId: string;                    // 'JASPER', 'COPYWRITER', 'VIDEO_SPECIALIST', etc.
  name: string;                       // human-readable label for the case
  description: string;                // what this case is meant to catch
  mode: RegressionMode;
  inputPayload: Record<string, unknown>; // the exact input fed to the agent
  active: boolean;                    // false = skip in runs without deletion
  tags: string[];                     // free-form labels ('delegation', 'memory', 'hero-page', etc.)
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  notes?: string;

  /**
   * For SINGLE_SHOT mode cases only. Declares allowable variance in the
   * structural shape of the output so the diff engine does not flag
   * within-spec creative variance as a regression. Example: the Copywriter
   * proposal spec allows 3-5 sections; recording a baseline with 4 sections
   * and comparing against a candidate that produced 5 should be WARN, not
   * FAIL, because both are inside the declared valid range.
   *
   * Paths use the same format the schema-diff engine emits (e.g.
   * '$.sections.length'). Only 'arrayLength' kind is supported today; more
   * kinds can be added later without breaking existing tolerances.
   */
  shapeTolerances?: ShapeTolerance[];

  /**
   * For TOOL_CALLING mode cases only. Maps tool NAME to a canned mock result
   * that is fed back to the model when that tool is called. Same result is
   * used for both baseline and candidate runs so the conversation trajectory
   * is determined solely by the model, not by divergent tool outputs. Any
   * tool the model calls that is not in this map receives a generic
   * `{ status: 'mocked', note: 'tool not scripted' }` stub so the chain can
   * still continue.
   *
   * Ignored for SINGLE_SHOT mode cases (no tool calls in that mode).
   */
  mockToolResults?: Record<string, unknown>;

  /**
   * Baselines keyed by the HONEST OpenRouter model id (e.g.
   * 'anthropic/claude-sonnet-4.6'), NOT an internal alias. The harness refuses
   * to record a baseline under an alias to prevent the same kind of stale
   * label that caused the 3.5→4 mismatch.
   */
  baselines: Record<string, RegressionBaseline>;
}

/**
 * A baseline snapshot for one (case × model) pair. Represents "what this
 * model did on this case at the time of recording" and becomes the ground
 * truth that future runs diff against.
 */
export interface RegressionBaseline {
  modelId: string;                    // honest OpenRouter id
  recordedAt: string;
  recordedBy: string;
  signature: CaptureSignature;        // the captured behavior (tool calls or JSON shape)
  runIds: string[];                   // links to full raw artifacts in regressionRuns
  notes?: string;
}

// ============================================================================
// CAPTURE SIGNATURE — what we record from a single agent invocation
// ============================================================================

/**
 * The discriminated union of what a single invocation captures. Mode A agents
 * (tool-calling) produce ToolCallSignature. Mode B agents (single-shot)
 * produce SingleShotSignature. A case's mode dictates which one appears.
 */
export type CaptureSignature = ToolCallSignature | SingleShotSignature;

export interface ToolCallSignature {
  kind: 'TOOL_CALLING';
  stepCount: number;
  steps: ToolCallStep[];
  terminalState: TerminalState;
  finalText?: string;                 // final assistant text response if the chain ended with one
  totalDurationMs: number;
}

export interface ToolCallStep {
  index: number;                      // 0-based step position in the sequence
  toolName: string;
  argKeys: string[];                  // sorted, top-level key names from the tool call arguments
  argKeyShapeHash: string;            // stable hash of sorted argKeys (for quick equality check)
}

export interface SingleShotSignature {
  kind: 'SINGLE_SHOT';
  schemaValid: boolean;
  schemaErrors: string[];             // empty if schemaValid is true
  shape: JsonShape;                   // structural shape of the returned JSON
  invariants: InvariantResult[];      // per-invariant pass/fail with optional message
  terminalState: TerminalState;
  totalDurationMs: number;
}

/**
 * Recursive structural description of a JSON value. Captures the SHAPE
 * (keys, array lengths, primitive types) without the VALUES, which drift
 * naturally between runs. Two outputs with the same shape are structurally
 * equivalent even if the text is completely different.
 */
export type JsonShape =
  | { kind: 'primitive'; primitiveType: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'array'; length: number; itemShapes: JsonShape[] }
  | { kind: 'object'; keys: string[]; fields: Record<string, JsonShape> };

export interface InvariantResult {
  id: string;                         // stable identifier for the invariant
  description: string;                // human-readable rule text
  passed: boolean;
  message?: string;                   // failure detail if passed === false
}

export type TerminalState =
  | 'FINAL_RESPONSE'                  // chain ended with a normal final message
  | 'MAX_STEPS_REACHED'               // hit the step-count ceiling before terminating
  | 'TOOL_ERROR'                      // a tool call returned an error
  | 'SCHEMA_REJECTED'                 // single-shot output failed Zod validation
  | 'PROVIDER_ERROR'                  // LLM call itself failed
  | 'EMPTY_RESPONSE';                 // provider returned empty content

// ============================================================================
// DIFF RESULT — what the comparison produces
// ============================================================================

export type DiffVerdict = 'PASS' | 'WARN' | 'FAIL';

export type DiffClass =
  // Tool-calling mode
  | 'STEP_COUNT_DELTA'                // different number of tool calls
  | 'TOOL_SET_DELTA'                  // different set of tools called (added/removed)
  | 'ORDER_DELTA'                     // same tools, wrong order
  | 'ARG_SHAPE_DELTA'                 // same tool, different argument keys
  | 'TERMINAL_DELTA'                  // different terminal state
  // Single-shot mode
  | 'SCHEMA_DELTA'                    // candidate failed validation, baseline passed (or vice versa)
  | 'SHAPE_DELTA'                     // structural JSON shape changed
  | 'INVARIANT_DELTA'                 // candidate violated an invariant the baseline passed
  | 'REFERENCE_DELTA'                 // (reserved) requested ids not echoed back — enforced via invariants today
  // Shared
  | 'NON_DETERMINISM'                 // candidate produced different signatures across repeat runs on same input
  | 'DURATION_OUTLIER';               // informational — candidate took >>longer than baseline

export interface DiffEntry {
  diffClass: DiffClass;
  severity: DiffVerdict;              // PASS entries are never produced; entries exist only when something differs
  path: string;                       // dot/bracket path into the signature pointing at the delta
  baselineValue: unknown;
  candidateValue: unknown;
  message: string;                    // human-readable explanation
}

export interface CaseDiff {
  caseId: string;
  verdict: DiffVerdict;               // worst severity across all entries (FAIL > WARN > PASS)
  entries: DiffEntry[];
  candidateSignatures: CaptureSignature[]; // N=3 candidate captures (for non-determinism detection)
  baselineSignature: CaptureSignature;
  notes?: string;
}

// ============================================================================
// RUN RECORD — persistent forensic log of a comparison execution
// ============================================================================

/**
 * One regression run compares a candidate model against a baseline model on
 * an entire case corpus for a single agent. Stored as a complete artifact so
 * the owner can inspect any past run without rerunning it.
 */
export interface RegressionRun {
  runId: string;
  agentId: string;
  baselineModelId: string;            // honest OpenRouter id
  candidateModelId: string;           // honest OpenRouter id
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;                // cli user or automation name
  runsPerCase: number;                // N in N=3 — how many times each case ran per model
  temperature: number;                // harness-locked regression temperature
  overallVerdict: DiffVerdict;        // worst case verdict across the corpus
  caseCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  caseDiffs: CaseDiff[];
  rawArtifacts: RegressionRawArtifact[]; // full request/response bodies for forensic review
  errorMessage?: string;              // set if the run crashed mid-way
}

export interface RegressionRawArtifact {
  caseId: string;
  modelId: string;
  runIndex: number;                   // 0..N-1
  requestBody: unknown;               // serialized OpenRouter request
  responseBody: unknown;              // serialized OpenRouter response
  capturedSignature: CaptureSignature;
  capturedAt: string;
  durationMs: number;
}

// ============================================================================
// HARNESS CONSTANTS — locked defaults
// ============================================================================

/**
 * Regression runs MUST use temperature 0 to eliminate noise from the diff.
 * Production agent temperatures are unaffected; this override applies only
 * inside the harness.
 */
export const REGRESSION_TEMPERATURE = 0;

/**
 * Each case runs N times per model. A case is only PASS if all N candidate
 * captures match the baseline. Non-determinism at temperature 0 is itself
 * a FAIL — you should not upgrade to a model that varies on identical input.
 */
export const REGRESSION_RUNS_PER_CASE = 3;

/**
 * Hard ceiling for tool-calling chains during regression. Real Jasper runs
 * can exceed this; the harness uses this as a safety brake so a runaway
 * candidate does not burn budget indefinitely. If a baseline run hits this
 * ceiling the case is UNRECORDABLE and must be trimmed or the ceiling raised.
 */
export const REGRESSION_MAX_TOOL_STEPS = 20;
