'use client';

/**
 * ImportCsvModal — one reusable CSV importer for the three CRM lists
 * (contacts, companies, deals). Renders its own "Import CSV" trigger button
 * plus a Dialog that walks the user through:
 *   1. pick / drop a .csv file
 *   2. map each CSV column to a CRM field (obvious headers auto-match)
 *   3. review a small preview, then import
 *   4. read a plain-English result summary (created / skipped / per-row errors)
 *
 * Posts the parsed rows + column mapping to the matching import route and
 * calls `onImported()` so the parent list can refresh.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SectionDescription, Caption } from '@/components/ui/typography';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types + per-object field configuration
// ---------------------------------------------------------------------------

export type ImportObjectType = 'contact' | 'company' | 'deal';

interface FieldDef {
  /** Target model field the import route understands. */
  field: string;
  /** Friendly label shown in the mapping dropdown. */
  label: string;
  /** Whether the object cannot be created without it (drives a warning). */
  required?: boolean;
  /** Lowercased header aliases used to auto-match CSV columns. */
  aliases: string[];
}

interface ObjectConfig {
  title: string;
  endpoint: string;
  fields: FieldDef[];
}

const IGNORE_FIELD = '__ignore__';

const CONFIGS: Record<ImportObjectType, ObjectConfig> = {
  contact: {
    title: 'Contacts',
    endpoint: '/api/contacts/import',
    fields: [
      { field: 'firstName', label: 'First name', aliases: ['first name', 'firstname', 'first', 'given name'] },
      { field: 'lastName', label: 'Last name', aliases: ['last name', 'lastname', 'last', 'surname', 'family name'] },
      { field: 'name', label: 'Full name', aliases: ['name', 'full name', 'contact name', 'fullname'] },
      { field: 'email', label: 'Email', aliases: ['email', 'email address', 'e-mail', 'mail'] },
      { field: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'cell', 'telephone'] },
      { field: 'company', label: 'Company', aliases: ['company', 'company name', 'organization', 'organisation', 'employer'] },
      { field: 'title', label: 'Job title', aliases: ['title', 'job title', 'position', 'role'] },
      { field: 'department', label: 'Department', aliases: ['department', 'dept'] },
      { field: 'website', label: 'Website', aliases: ['website', 'url', 'web', 'site'] },
      { field: 'linkedInUrl', label: 'LinkedIn URL', aliases: ['linkedin', 'linkedin url', 'linkedinurl'] },
      { field: 'twitterHandle', label: 'Twitter / X handle', aliases: ['twitter', 'twitter handle', 'x handle'] },
      { field: 'tags', label: 'Tags (comma-separated)', aliases: ['tags', 'tag', 'labels'] },
      { field: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'description'] },
    ],
  },
  company: {
    title: 'Companies',
    endpoint: '/api/crm/companies/import',
    fields: [
      { field: 'name', label: 'Company name', required: true, aliases: ['name', 'company', 'company name', 'organization', 'organisation', 'account'] },
      { field: 'website', label: 'Website', aliases: ['website', 'url', 'web', 'site', 'domain'] },
      { field: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'telephone'] },
      { field: 'email', label: 'Email', aliases: ['email', 'email address', 'e-mail'] },
      { field: 'industry', label: 'Industry', aliases: ['industry', 'sector', 'vertical'] },
      { field: 'description', label: 'Description', aliases: ['description', 'about', 'summary'] },
      { field: 'size', label: 'Size (startup/small/medium/enterprise)', aliases: ['size', 'company size'] },
      { field: 'status', label: 'Status (prospect/active/inactive/churned)', aliases: ['status', 'stage'] },
      { field: 'employeeCount', label: 'Employee count', aliases: ['employees', 'employee count', 'headcount', 'staff'] },
      { field: 'annualRevenue', label: 'Annual revenue', aliases: ['revenue', 'annual revenue', 'turnover'] },
      { field: 'linkedInUrl', label: 'LinkedIn URL', aliases: ['linkedin', 'linkedin url'] },
      { field: 'twitterHandle', label: 'Twitter / X handle', aliases: ['twitter', 'x handle'] },
      { field: 'facebookUrl', label: 'Facebook URL', aliases: ['facebook', 'facebook url'] },
      { field: 'tags', label: 'Tags (comma-separated)', aliases: ['tags', 'tag', 'labels'] },
      { field: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments'] },
    ],
  },
  deal: {
    title: 'Deals',
    endpoint: '/api/deals/import',
    fields: [
      { field: 'name', label: 'Deal name', required: true, aliases: ['name', 'deal', 'deal name', 'title', 'opportunity'] },
      { field: 'value', label: 'Value (number)', aliases: ['value', 'amount', 'deal value', 'price', 'worth'] },
      { field: 'company', label: 'Company', aliases: ['company', 'company name', 'account', 'organization'] },
      { field: 'contactId', label: 'Contact ID', aliases: ['contact id', 'contactid', 'contact'] },
      { field: 'currency', label: 'Currency', aliases: ['currency', 'ccy'] },
      { field: 'stage', label: 'Stage', aliases: ['stage', 'pipeline stage', 'status'] },
      { field: 'probability', label: 'Probability (0-100)', aliases: ['probability', 'win probability', 'likelihood'] },
      { field: 'source', label: 'Source', aliases: ['source', 'lead source'] },
      { field: 'expectedCloseDate', label: 'Expected close date', aliases: ['close date', 'expected close date', 'expected close'] },
      { field: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments'] },
    ],
  },
};

interface RowError {
  row: number;
  message: string;
}

interface ImportSummary {
  total: number;
  created: number;
  skipped: number;
  errors: RowError[];
}

type Step = 'select' | 'map' | 'importing' | 'result';

interface ImportCsvModalProps {
  object: ImportObjectType;
  onImported?: () => void;
  /** Optional override for the trigger button label. */
  triggerLabel?: string;
}

// ---------------------------------------------------------------------------
// Minimal client-side CSV parsing (quote aware) — mirrors the server helper.
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

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) { return { headers: [], rows: [] }; }

  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCsvLine(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => { row[header] = values[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

function autoMatch(headers: string[], fields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const norm = normalizeHeader(header);
    const hit = fields.find(
      (f) => !used.has(f.field) && (normalizeHeader(f.field) === norm || f.aliases.includes(norm))
    );
    if (hit) {
      mapping[header] = hit.field;
      used.add(hit.field);
    } else {
      mapping[header] = IGNORE_FIELD;
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportCsvModal({ object, onImported, triggerLabel }: ImportCsvModalProps) {
  const config = CONFIGS[object];
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const reset = useCallback(() => {
    setStep('select');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setDragActive(false);
    setError(null);
    setSummary(null);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) { reset(); }
  }, [reset]);

  const ingestFile = useCallback((file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please choose a .csv file. You can export one from Excel or Google Sheets.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const { headers: parsedHeaders, rows: parsedRows } = parseCsv(text);
      if (parsedHeaders.length === 0) {
        setError('That file looks empty — it has no column headings.');
        return;
      }
      if (parsedRows.length === 0) {
        setError('That file has column headings but no rows of data to import.');
        return;
      }
      setFileName(file.name);
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setMapping(autoMatch(parsedHeaders, config.fields));
      setStep('map');
    };
    reader.onerror = () => setError('Sorry, that file could not be read. Please try again.');
    reader.readAsText(file);
  }, [config.fields]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { ingestFile(file); }
  }, [ingestFile]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { ingestFile(file); }
  }, [ingestFile]);

  const mappedFieldsInUse = useMemo(
    () => new Set(Object.values(mapping).filter((v) => v && v !== IGNORE_FIELD)),
    [mapping]
  );

  const requiredMissing = useMemo(
    () => config.fields.filter((f) => f.required && !mappedFieldsInUse.has(f.field)),
    [config.fields, mappedFieldsInUse]
  );

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    setError(null);
    try {
      const response = await authFetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mapping }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : 'The import could not be completed.';
        setError(message);
        setStep('map');
        return;
      }
      setSummary(payload as ImportSummary);
      setStep('result');
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong during the import.');
      setStep('map');
    }
  }, [authFetch, config.endpoint, rows, mapping, onImported]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        {triggerLabel ?? 'Import CSV'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import {config.title} from a CSV</DialogTitle>
            <DialogDescription>
              Upload a spreadsheet and match its columns to your CRM fields. We will tell you exactly
              what was added and skip anything that does not look right.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          {/* STEP 1 — choose a file */}
          {step === 'select' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border-strong'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              <SectionDescription>
                Drag a .csv file here, or choose one from your computer.
              </SectionDescription>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileInput}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
            </div>
          )}

          {/* STEP 2 — map columns + preview */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="font-medium text-foreground">{fileName}</span>
                <span>· {rows.length} row{rows.length === 1 ? '' : 's'} found</span>
              </div>

              <div>
                <Caption>Match your columns</Caption>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {headers.map((header) => (
                    <div key={header} className="grid grid-cols-2 items-center gap-3">
                      <span className="truncate text-sm text-foreground" title={header}>{header}</span>
                      <select
                        value={mapping[header] ?? IGNORE_FIELD}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value={IGNORE_FIELD}>Do not import</option>
                        {config.fields.map((f) => (
                          <option
                            key={f.field}
                            value={f.field}
                            disabled={mappedFieldsInUse.has(f.field) && mapping[header] !== f.field}
                          >
                            {f.label}{f.required ? ' (required)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {requiredMissing.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Please match a column to{' '}
                    {requiredMissing.map((f) => f.label).join(' and ')} — rows without it cannot be imported.
                  </span>
                </div>
              )}

              <div>
                <Caption>Preview (first {previewRows.length} row{previewRows.length === 1 ? '' : 's'})</Caption>
                <div className="mt-2 overflow-x-auto rounded-lg border border-border-strong">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-border-light">
                          {headers.map((h) => (
                            <td key={h} className="whitespace-nowrap px-3 py-1.5 text-foreground">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <SectionDescription>Importing your {config.title.toLowerCase()}…</SectionDescription>
            </div>
          )}

          {/* STEP 4 — result */}
          {step === 'result' && summary && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span className="text-base font-medium text-foreground">
                  Added {summary.created} of {summary.total} row{summary.total === 1 ? '' : 's'}.
                </span>
              </div>
              {summary.skipped > 0 && (
                <SectionDescription>
                  {summary.skipped} row{summary.skipped === 1 ? ' was' : 's were'} skipped (see below).
                </SectionDescription>
              )}
              {summary.errors.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border-strong p-3">
                  {summary.errors.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <X className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">Row {e.row}:</span> {e.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {step === 'map' && (
              <>
                <Button variant="outline" onClick={() => { reset(); }}>
                  Choose a different file
                </Button>
                <Button onClick={() => void handleImport()} disabled={requiredMissing.length > 0}>
                  Import {rows.length} row{rows.length === 1 ? '' : 's'}
                </Button>
              </>
            )}
            {step === 'result' && (
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
