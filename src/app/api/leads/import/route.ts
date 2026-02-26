import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLead, type Lead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Field-mapping table: normalises common CSV header variations to our schema
// ---------------------------------------------------------------------------

const HEADER_MAP: Record<string, string> = {
  'first name': 'firstName',
  firstname: 'firstName',
  first_name: 'firstName',
  'last name': 'lastName',
  lastname: 'lastName',
  last_name: 'lastName',
  email: 'email',
  'email address': 'email',
  email_address: 'email',
  'e-mail': 'email',
  phone: 'phone',
  'phone number': 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  company: 'company',
  'company name': 'companyName',
  company_name: 'companyName',
  companyname: 'companyName',
  organisation: 'company',
  organization: 'company',
  title: 'title',
  'job title': 'title',
  job_title: 'title',
  position: 'title',
  source: 'source',
  'lead source': 'source',
  lead_source: 'source',
  status: 'status',
  'lead status': 'status',
  tags: 'tags',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
};

// ---------------------------------------------------------------------------
// Zod schema for a single validated CSV row
// ---------------------------------------------------------------------------

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

const csvRowSchema = z.object({
  firstName: z.string().min(1, 'firstName is required'),
  lastName: z.string().min(1, 'lastName is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  companyName: z.string().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(VALID_STATUSES).optional().default('new'),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type CsvRowInput = z.input<typeof csvRowSchema>;

// ---------------------------------------------------------------------------
// Import summary shape returned to the caller
// ---------------------------------------------------------------------------

interface RowError {
  row: number;
  email: string | undefined;
  reason: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: RowError[];
}

// ---------------------------------------------------------------------------
// CSV parsing helpers
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
  const nonEmpty = lines.filter(l => l.trim().length > 0);

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = parseCsvLine(nonEmpty[0]);
  const headers = rawHeaders.map(h => {
    const lower = h.toLowerCase().replace(/\s+/g, ' ').trim();
    return HEADER_MAP[lower] ?? lower;
  });

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

function rawRowToInput(raw: Record<string, string>): CsvRowInput {
  const tagsRaw = raw['tags'] ?? '';
  const tags = tagsRaw.length > 0
    ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : undefined;

  return {
    firstName: raw['firstName'] ?? '',
    lastName: raw['lastName'] ?? '',
    email: raw['email'] ?? '',
    phone: raw['phone'] || undefined,
    company: raw['company'] || undefined,
    companyName: raw['companyName'] || undefined,
    title: raw['title'] || undefined,
    source: raw['source'] || undefined,
    status: (raw['status'] || undefined) as CsvRowInput['status'],
    tags,
    notes: raw['notes'] || undefined,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing "file" field in form data' },
        { status: 400 }
      );
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds the 10 MB size limit' },
        { status: 413 }
      );
    }

    const csvText = await file.text();
    const { rows } = parseCsv(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file contains no data rows' },
        { status: 422 }
      );
    }

    const summary: ImportSummary = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const seenEmails = new Set<string>();
    const createdLeadIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is the header
      const raw = rows[i];

      const rawEmail = (raw['email'] ?? '').trim();
      if (!rawEmail) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, email: undefined, reason: 'Missing email — row skipped' });
        continue;
      }

      const emailKey = rawEmail.toLowerCase();
      if (seenEmails.has(emailKey)) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, email: rawEmail, reason: 'Duplicate email within import — row skipped' });
        continue;
      }
      seenEmails.add(emailKey);

      const parsed = csvRowSchema.safeParse(rawRowToInput(raw));
      if (!parsed.success) {
        const reason = parsed.error.errors.map(e => e.message).join('; ');
        summary.skipped++;
        summary.errors.push({ row: rowNumber, email: rawEmail, reason });
        continue;
      }

      const { data } = parsed;

      const leadInput: Omit<Lead, 'id' | 'createdAt'> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        companyName: data.companyName,
        title: data.title,
        source: data.source,
        status: data.status,
        tags: data.tags,
        ...(data.notes ? { customFields: { notes: data.notes } } : {}),
      };

      try {
        const created = await createLead(leadInput);
        createdLeadIds.push(created.id);
        summary.imported++;
      } catch (createError) {
        const reason = createError instanceof Error ? createError.message : String(createError);
        summary.skipped++;
        summary.errors.push({ row: rowNumber, email: rawEmail, reason: `Failed to persist lead: ${reason}` });
        logger.error(
          'CSV import: lead creation failed',
          createError instanceof Error ? createError : new Error(String(createError)),
          { file: 'leads/import/route.ts', row: rowNumber }
        );
      }
    }

    // Fire-and-forget auto-scoring for all imported leads
    if (createdLeadIds.length > 0) {
      void (async () => {
        try {
          const { autoScoreLead } = await import('@/lib/services/lead-scoring-engine');
          await Promise.allSettled(
            createdLeadIds.map(id =>
              autoScoreLead(id).catch((scoreError: unknown) => {
                logger.warn('Auto-scoring trigger failed for imported lead', {
                  leadId: id,
                  error: scoreError instanceof Error ? scoreError.message : String(scoreError),
                });
              })
            )
          );
        } catch (scoreError) {
          logger.warn('Bulk auto-scoring trigger failed after CSV import', {
            count: createdLeadIds.length,
            error: scoreError instanceof Error ? scoreError.message : String(scoreError),
          });
        }
      })();
    }

    logger.info('CSV lead import completed', {
      file: 'leads/import/route.ts',
      total: summary.total,
      imported: summary.imported,
      skipped: summary.skipped,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      'CSV lead import failed unexpectedly',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'leads/import/route.ts' }
    );
    const message = error instanceof Error ? error.message : 'CSV import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
