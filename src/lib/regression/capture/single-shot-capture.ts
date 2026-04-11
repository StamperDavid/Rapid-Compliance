/**
 * Single-Shot Capture — records structural signature for JSON-returning specialists
 *
 * Runs one chat completion against the honest model and records the structural
 * shape of the returned JSON, schema validity, and any declared invariants.
 * Used by agents like Copywriter and Video Specialist that return a single
 * JSON blob with no tool calls.
 *
 * The captured SingleShotSignature ignores TEXT and captures STRUCTURE —
 * two outputs with identical shapes are structurally equivalent even if the
 * prose is different. That is the right granularity for catching model-swap
 * regressions without flagging normal creative variance as a regression.
 */

import type { ZodSchema } from 'zod';
import type {
  SingleShotSignature,
  JsonShape,
  InvariantResult,
  TerminalState,
} from '@/types/regression';
import { directChat } from './openrouter-direct';

/**
 * An invariant is a case-specific rule the specialist's output must satisfy
 * (e.g. "h2.length equals sections.length"). Invariants are authored per case
 * because they depend on the specialist's output contract.
 */
export interface InvariantCheck {
  id: string;
  description: string;
  check: (parsed: unknown) => { passed: boolean; message?: string };
}

export interface SingleShotCaptureInput {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  schema?: ZodSchema;                 // optional — when provided, output is validated
  invariants?: InvariantCheck[];      // optional — additional per-case invariants
  stripJsonFences?: boolean;          // default true — strip ```json fences before parsing
}

export interface SingleShotCaptureResult {
  signature: SingleShotSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
  parsedOutput: unknown;              // the parsed JSON (or null if unparseable)
}

// ============================================================================
// JSON shape extractor
// ============================================================================

/**
 * Recursively walk a JSON value and produce a JsonShape that captures
 * structure (keys, lengths, primitive types) without the values. Nested
 * arrays preserve their length and per-item shape so "3 sections" vs "4
 * sections" is a detectable delta.
 */
export function extractJsonShape(value: unknown): JsonShape {
  if (value === null) {
    return { kind: 'primitive', primitiveType: 'null' };
  }
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return { kind: 'primitive', primitiveType: valueType };
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      itemShapes: value.map(extractJsonShape),
    };
  }
  if (valueType === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const fields: Record<string, JsonShape> = {};
    for (const key of keys) {
      fields[key] = extractJsonShape(obj[key]);
    }
    return { kind: 'object', keys, fields };
  }
  // Fallback for exotic types — record as null primitive
  return { kind: 'primitive', primitiveType: 'null' };
}

// ============================================================================
// Fence stripping (same behavior as Copywriter.stripJsonFences)
// ============================================================================

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

// ============================================================================
// Main capture
// ============================================================================

export async function captureSingleShot(
  input: SingleShotCaptureInput,
): Promise<SingleShotCaptureResult> {
  const captureStartedAt = Date.now();
  let terminalState: TerminalState = 'FINAL_RESPONSE';
  let parsedOutput: unknown = null;
  let schemaValid = false;
  const schemaErrors: string[] = [];
  const invariants: InvariantResult[] = [];

  let response;
  try {
    response = await directChat({
      modelId: input.modelId,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userMessage },
      ],
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  } catch (err) {
    return {
      signature: {
        kind: 'SINGLE_SHOT',
        schemaValid: false,
        schemaErrors: [err instanceof Error ? err.message : String(err)],
        shape: { kind: 'primitive', primitiveType: 'null' },
        invariants: [],
        terminalState: 'PROVIDER_ERROR',
        totalDurationMs: Date.now() - captureStartedAt,
      },
      rawRequestBody: { modelId: input.modelId, messages: [{ role: 'system' }, { role: 'user' }] },
      rawResponseBody: { error: err instanceof Error ? err.message : String(err) },
      parsedOutput: null,
    };
  }

  const rawContent = response.content;
  if (rawContent.trim().length === 0) {
    terminalState = 'EMPTY_RESPONSE';
    return {
      signature: {
        kind: 'SINGLE_SHOT',
        schemaValid: false,
        schemaErrors: ['empty response from model'],
        shape: { kind: 'primitive', primitiveType: 'null' },
        invariants: [],
        terminalState,
        totalDurationMs: Date.now() - captureStartedAt,
      },
      rawRequestBody: response.rawRequestBody,
      rawResponseBody: response.rawResponseBody,
      parsedOutput: null,
    };
  }

  const cleaned = input.stripJsonFences !== false ? stripJsonFences(rawContent) : rawContent;
  try {
    parsedOutput = JSON.parse(cleaned);
  } catch (err) {
    schemaErrors.push(`JSON parse error: ${err instanceof Error ? err.message : String(err)}`);
    terminalState = 'SCHEMA_REJECTED';
  }

  if (parsedOutput !== null && input.schema) {
    const result = input.schema.safeParse(parsedOutput);
    if (result.success) {
      schemaValid = true;
    } else {
      schemaValid = false;
      for (const issue of result.error.issues) {
        schemaErrors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
      terminalState = 'SCHEMA_REJECTED';
    }
  } else if (parsedOutput !== null && !input.schema) {
    // No schema provided — we can only confirm JSON parsed
    schemaValid = true;
  }

  if (parsedOutput !== null && input.invariants && input.invariants.length > 0) {
    for (const invariant of input.invariants) {
      try {
        const result = invariant.check(parsedOutput);
        invariants.push({
          id: invariant.id,
          description: invariant.description,
          passed: result.passed,
          message: result.message,
        });
      } catch (err) {
        invariants.push({
          id: invariant.id,
          description: invariant.description,
          passed: false,
          message: `invariant threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  const shape = parsedOutput !== null
    ? extractJsonShape(parsedOutput)
    : { kind: 'primitive' as const, primitiveType: 'null' as const };

  return {
    signature: {
      kind: 'SINGLE_SHOT',
      schemaValid,
      schemaErrors,
      shape,
      invariants,
      terminalState,
      totalDurationMs: Date.now() - captureStartedAt,
    },
    rawRequestBody: response.rawRequestBody,
    rawResponseBody: response.rawResponseBody,
    parsedOutput,
  };
}
