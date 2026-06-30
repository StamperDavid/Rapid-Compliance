/**
 * POST /api/crm/companies/import
 *
 * Bulk-import companies from a parsed CSV. Modeled on
 * `src/app/api/leads/import/route.ts`: validates each row independently,
 * never throws on a single bad row, and returns a structured
 * { created, skipped, errors } summary.
 *
 * Body (see `importBodySchema`): { rows | csvText, mapping } where `mapping`
 * is originalCsvHeader -> target Company field.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCompany } from '@/lib/crm/company-service';
import { logger } from '@/lib/logger/logger';
import { requireRole } from '@/lib/auth/api-auth';
import type { CreateCompanyInput } from '@/types/company';
import {
  importBodySchema,
  parseImportBody,
  applyMapping,
  splitTags,
  parseNumber,
  zodMessage,
  type ImportSummary,
} from '@/lib/crm/csv-import-helpers';

export const dynamic = 'force-dynamic';

const companyRowSchema = z.object({
  name: z.string().min(1, 'company name is required'),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'enterprise', 'unknown']).optional(),
  status: z.enum(['prospect', 'active', 'inactive', 'churned']).optional(),
  employeeCount: z.string().optional(),
  annualRevenue: z.string().optional(),
  linkedInUrl: z.string().optional(),
  twitterHandle: z.string().optional(),
  facebookUrl: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireRole(request, ['owner', 'admin', 'manager']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsedBody = importBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid import request', details: parsedBody.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let sourceRows: Record<string, string>[];
    try {
      sourceRows = parseImportBody(parsedBody.data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'No rows to import' },
        { status: 422 }
      );
    }

    if (sourceRows.length === 0) {
      return NextResponse.json({ error: 'The file has no data rows to import' }, { status: 422 });
    }

    const summary: ImportSummary = {
      total: sourceRows.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    const seenNames = new Set<string>();

    for (let i = 0; i < sourceRows.length; i++) {
      const rowNumber = i + 2; // +2: row 1 is the header
      const mapped = applyMapping(sourceRows[i], parsedBody.data.mapping);

      const parsed = companyRowSchema.safeParse(mapped);
      if (!parsed.success) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: zodMessage(parsed.error) });
        continue;
      }

      const data = parsed.data;

      const nameKey = data.name.toLowerCase();
      if (seenNames.has(nameKey)) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: `Duplicate company "${data.name}" in this file — row skipped` });
        continue;
      }
      seenNames.add(nameKey);

      const companyInput: CreateCompanyInput = {
        name: data.name,
        website: data.website,
        phone: data.phone,
        email: data.email,
        industry: data.industry,
        description: data.description,
        size: data.size,
        status: data.status ?? 'prospect',
        employeeCount: parseNumber(data.employeeCount),
        annualRevenue: parseNumber(data.annualRevenue),
        linkedInUrl: data.linkedInUrl,
        twitterHandle: data.twitterHandle,
        facebookUrl: data.facebookUrl,
        notes: data.notes,
        tags: splitTags(data.tags),
      };

      try {
        await createCompany(companyInput);
        summary.created++;
      } catch (createError) {
        const reason = createError instanceof Error ? createError.message : String(createError);
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: `Could not save this company: ${reason}` });
        logger.error(
          'CSV company import: create failed',
          createError instanceof Error ? createError : new Error(String(createError)),
          { file: 'crm/companies/import/route.ts', row: rowNumber }
        );
      }
    }

    logger.info('CSV company import completed', {
      file: 'crm/companies/import/route.ts',
      total: summary.total,
      created: summary.created,
      skipped: summary.skipped,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      'CSV company import failed unexpectedly',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'crm/companies/import/route.ts' }
    );
    const message = error instanceof Error ? error.message : 'Company import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
