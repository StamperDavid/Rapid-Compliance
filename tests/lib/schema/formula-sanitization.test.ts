/**
 * Formula Engine Sanitization Unit Tests
 *
 * Tests the security sandbox in FormulaEngine.safeEval (exercised via the
 * public evaluate() and validate() methods).
 *
 * Dangerous keyword detection uses a word-boundary regex (\b), so substrings
 * like "processing" must NOT be blocked while bare keywords like "process" must.
 */

import { describe, it, expect } from '@jest/globals';
import { FormulaEngine } from '@/lib/schema/formula-engine';
import type { SchemaField, FieldType } from '@/types/schema';
import type { EntityRecord } from '@/types/entity';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Helpers
// ============================================================================

const engine = new FormulaEngine();

/**
 * Sentinel Timestamp used for required createdAt/updatedAt fields on SchemaField.
 * The FormulaEngine never reads these fields; they are present only to satisfy
 * the SchemaField interface.
 */
const TS = Timestamp.now();

/**
 * Build a minimal SchemaField array from a plain key->type map.
 * We cast via unknown to SchemaField[] because the FormulaEngine only reads
 * .key and .type from each field — the remaining required Firestore-timestamp
 * fields are structural metadata that the formula evaluator never accesses.
 */
function makeFields(fieldDefs: Record<string, FieldType>): SchemaField[] {
  return Object.entries(fieldDefs).map(([key, type]) => ({
    id: key,
    key,
    label: key,
    type,
    config: { type } as SchemaField['config'],
    required: false,
    unique: false,
    readonly: false,
    hidden: false,
    createdAt: TS,
    updatedAt: TS,
  })) as SchemaField[];
}

/**
 * Build a minimal EntityRecord from a plain key->value map.
 * The formula evaluator only reads the dynamic [key] values; id, schemaId,
 * and _meta are required by the interface but not accessed during formula eval.
 */
function makeRecord(values: Record<string, unknown>): EntityRecord {
  return {
    id: 'test_record',
    schemaId: 'test_schema',
    _meta: {
      createdAt: TS,
      createdBy: 'test',
      updatedAt: TS,
      updatedBy: 'test',
      version: 1,
    },
    ...values,
  };
}

// ============================================================================
// Normal (safe) formulas — should evaluate without error
// ============================================================================

describe('FormulaEngine — safe formulas', () => {
  it('evaluates a simple arithmetic formula: "price * quantity"', () => {
    const fields = makeFields({ price: 'number', quantity: 'number' });
    const record = makeRecord({ price: 10, quantity: 5 });

    const result = engine.evaluate('price * quantity', record, fields);

    expect(result).toBe(50);
  });

  it('evaluates Math.round via injected Math object: "Math.round(value)"', () => {
    const fields = makeFields({ value: 'number' });
    const record = makeRecord({ value: 4.7 });

    const result = engine.evaluate('Math.round(value)', record, fields);

    expect(result).toBe(5);
  });

  it('evaluates a simple addition formula: "a + b"', () => {
    const fields = makeFields({ a: 'number', b: 'number' });
    const record = makeRecord({ a: 3, b: 7 });

    const result = engine.evaluate('a + b', record, fields);

    expect(result).toBe(10);
  });

  it('evaluates a string concatenation using CONCAT', () => {
    const fields = makeFields({ first_name: 'text', last_name: 'text' });
    const record = makeRecord({ first_name: 'John', last_name: 'Doe' });

    const result = engine.evaluate('CONCAT(first_name, " ", last_name)', record, fields);

    expect(result).toBe('John Doe');
  });

  it('evaluates a conditional formula using IF', () => {
    const fields = makeFields({ score: 'number' });
    const record = makeRecord({ score: 90 });

    const result = engine.evaluate('IF(score > 80, "hot", "warm")', record, fields);

    expect(result).toBe('hot');
  });

  it('evaluates a ROUND formula: "ROUND(price * (1 - discount / 100), 2)"', () => {
    const fields = makeFields({ price: 'number', discount: 'number' });
    const record = makeRecord({ price: 100, discount: 15 });

    const result = engine.evaluate('ROUND(price * (1 - discount / 100), 2)', record, fields);

    expect(result).toBe(85);
  });

  it('validates a safe formula and returns valid: true', () => {
    const fields = makeFields({ amount: 'number', rate: 'number' });

    const validation = engine.validate('amount * rate', fields);

    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });
});

// ============================================================================
// Dangerous formulas — must be blocked by the sandbox
// ============================================================================

describe('FormulaEngine — dangerous formulas are blocked', () => {
  const safeFields = makeFields({ x: 'number' });
  const safeRecord = makeRecord({ x: 1 });

  it('blocks fetch() usage', () => {
    const result = engine.evaluate("fetch('http://evil.com')", safeRecord, safeFields);

    // evaluate() catches the thrown error and returns null
    expect(result).toBeNull();
  });

  it('blocks dynamic import()', () => {
    const result = engine.evaluate("import('fs')", safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('blocks process.exit()', () => {
    const result = engine.evaluate('process.exit()', safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('blocks eval()', () => {
    const result = engine.evaluate("eval('alert(1)')", safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('blocks constructor prototype escape: "constructor.constructor(\'return this\')"', () => {
    const result = engine.evaluate(
      "constructor.constructor('return this')()",
      safeRecord,
      safeFields
    );

    expect(result).toBeNull();
  });

  it('blocks require()', () => {
    const result = engine.evaluate("require('child_process')", safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('blocks Function constructor', () => {
    const result = engine.evaluate("Function('return process')()", safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('blocks globalThis access', () => {
    const result = engine.evaluate('globalThis.process', safeRecord, safeFields);

    expect(result).toBeNull();
  });

  it('validate() returns valid: false for a dangerous formula', () => {
    const validation = engine.validate("fetch('http://evil.com')", safeFields);

    expect(validation.valid).toBe(false);
    expect(validation.error).toBeDefined();
  });
});

// ============================================================================
// Edge cases — word-boundary matching
// ============================================================================

describe('FormulaEngine — word-boundary edge cases', () => {
  it('allows "processing" as a field name — substring of "process" but not the keyword itself', () => {
    // The danger regex uses \b so "processing" should NOT match \bprocess\b
    const fields = makeFields({ processing: 'number', total: 'number' });
    const record = makeRecord({ processing: 5, total: 100 });

    const result = engine.evaluate('total - processing', record, fields);

    // Should compute 95, not be blocked
    expect(result).toBe(95);
  });

  it('allows "evaluate" as a variable name — not a blocked keyword', () => {
    const fields = makeFields({ evaluate: 'number' });
    const record = makeRecord({ evaluate: 42 });

    const result = engine.evaluate('evaluate * 2', record, fields);

    expect(result).toBe(84);
  });

  it('blocks a formula that embeds the bare keyword "eval" with surrounding operators', () => {
    // "eval(" — should still be caught by the word boundary since ( is not \w
    const result = engine.evaluate("eval('1+1')", makeRecord({}), makeFields({}));

    expect(result).toBeNull();
  });

  it('allows a formula containing the word "document_id" — does not match \\bdocument\\b', () => {
    // "document_id" — the underscore after "document" means it is part of the same \w+ token
    // so \bdocument\b will NOT match "document_id"
    const fields = makeFields({ document_id: 'number' });
    const record = makeRecord({ document_id: 7 });

    const result = engine.evaluate('document_id * 10', record, fields);

    expect(result).toBe(70);
  });
});
