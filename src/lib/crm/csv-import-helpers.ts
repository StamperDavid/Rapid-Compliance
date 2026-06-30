/**
 * Shared CSV import helpers for the CRM bulk-import routes
 * (contacts, companies, deals).
 *
 * Mirrors the CSV parsing + per-row error-collection approach of
 * `src/app/api/leads/import/route.ts` but is object-agnostic: each import
 * route supplies its own field mapping + validation, while the parsing,
 * summary shape, and value coercion live here so all three routes behave
 * identically.
 *
 * Server-only: imported by API routes, never by client components.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Summary + error shapes returned to the caller
// ---------------------------------------------------------------------------

/** A single row that could not be imported, with a plain-English reason. */
export interface ImportRowError {
  /** 1-based source row number (header is row 1, first data row is row 2). */
  row: number;
  message: string;
}

/** The structured result every import route returns. */
export interface ImportSummary {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
}

// ---------------------------------------------------------------------------
// Request body shared by every import route
// ---------------------------------------------------------------------------

/**
 * Body accepted by every CRM import route. The client may either send the
 * already-parsed rows (keyed by their original CSV header) OR the raw CSV
 * text — plus a `mapping` of original-header → target-field. At least one of
 * `rows` / `csvText` must be present (enforced by `parseImportBody`).
 */
export const importBodySchema = z.object({
  csvText: z.string().optional(),
  rows: z.array(z.record(z.string())).optional(),
  /** originalCsvHeader -> targetModelField (omit / IGNORE to drop a column). */
  mapping: z.record(z.string()),
});

export type ImportBody = z.infer<typeof importBodySchema>;

/** Sentinel a mapping value can use to explicitly skip a column. */
export const IGNORE_FIELD = '__ignore__';

// ---------------------------------------------------------------------------
// CSV parsing — RFC-4180-ish, quote aware. Rows are keyed by ORIGINAL header
// (no header remapping here — the caller-supplied `mapping` does that).
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (ch === ',' && !insideQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse raw CSV text into a header list and an array of row objects keyed by
 * the original (trimmed) header text.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(nonEmpty[0]).map(h => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCsvLine(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Resolve the request body into a flat list of source rows (keyed by original
 * header). Throws a plain-English Error if neither `rows` nor `csvText` is
 * usable — the route turns that into a 422.
 */
export function parseImportBody(body: ImportBody): Record<string, string>[] {
  if (Array.isArray(body.rows) && body.rows.length > 0) {
    return body.rows;
  }
  if (typeof body.csvText === 'string' && body.csvText.trim().length > 0) {
    return parseCsv(body.csvText).rows;
  }
  throw new Error('No rows to import — provide either parsed rows or CSV text');
}

/**
 * Apply the `mapping` to a single source row, producing an object keyed by the
 * target model field. Empty strings become `undefined` so optional fields stay
 * absent. Columns mapped to nothing / IGNORE are dropped.
 */
export function applyMapping(
  sourceRow: Record<string, string>,
  mapping: Record<string, string>
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [sourceHeader, targetField] of Object.entries(mapping)) {
    if (!targetField || targetField === IGNORE_FIELD) { continue; }
    const raw = (sourceRow[sourceHeader] ?? '').trim();
    if (raw.length > 0) {
      mapped[targetField] = raw;
    }
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Small value coercion helpers shared across routes
// ---------------------------------------------------------------------------

/** Split a comma- or semicolon-separated cell into a clean string array. */
export function splitTags(value: string | undefined): string[] | undefined {
  if (!value) { return undefined; }
  const tags = value
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
  return tags.length > 0 ? tags : undefined;
}

/** Parse a numeric cell, stripping currency symbols / thousands separators. */
export function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) { return undefined; }
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (cleaned.length === 0) { return undefined; }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Turn a Zod error into a single readable sentence for a row. */
export function zodMessage(error: z.ZodError): string {
  return error.errors
    .map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
}
