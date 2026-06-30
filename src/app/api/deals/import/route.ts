/**
 * POST /api/deals/import
 *
 * Bulk-import deals from a parsed CSV. Modeled on
 * `src/app/api/leads/import/route.ts`: validates each row independently,
 * never throws on a single bad row, and returns a structured
 * { created, skipped, errors } summary.
 *
 * Body (see `importBodySchema`): { rows | csvText, mapping } where `mapping`
 * is originalCsvHeader -> target Deal field.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDeal } from '@/lib/crm/deal-service';
import type { Deal } from '@/lib/crm/deal-service-types';
import { logger } from '@/lib/logger/logger';
import { requireRole } from '@/lib/auth/api-auth';
import {
  importBodySchema,
  parseImportBody,
  applyMapping,
  parseNumber,
  zodMessage,
  type ImportSummary,
} from '@/lib/crm/csv-import-helpers';

export const dynamic = 'force-dynamic';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

const dealRowSchema = z.object({
  name: z.string().min(1, 'deal name is required'),
  value: z.string().optional(),
  company: z.string().optional(),
  companyName: z.string().optional(),
  contactId: z.string().optional(),
  currency: z.string().optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  probability: z.string().optional(),
  source: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  notes: z.string().optional(),
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

      const parsed = dealRowSchema.safeParse(mapped);
      if (!parsed.success) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: zodMessage(parsed.error) });
        continue;
      }

      const data = parsed.data;

      const nameKey = data.name.toLowerCase();
      if (seenNames.has(nameKey)) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: `Duplicate deal "${data.name}" in this file — row skipped` });
        continue;
      }
      seenNames.add(nameKey);

      // Parse the expected close date defensively — a bad date skips only the date.
      let expectedCloseDate: Date | undefined;
      if (data.expectedCloseDate) {
        const d = new Date(data.expectedCloseDate);
        expectedCloseDate = Number.isNaN(d.getTime()) ? undefined : d;
      }

      const probability = parseNumber(data.probability);

      const dealInput: Omit<Deal, 'id' | 'createdAt'> = {
        name: data.name,
        value: parseNumber(data.value) ?? 0,
        company: data.company,
        companyName: data.companyName,
        contactId: data.contactId,
        currency: data.currency,
        stage: data.stage ?? 'prospecting',
        probability: probability !== undefined ? Math.min(100, Math.max(0, probability)) : 10,
        source: data.source,
        notes: data.notes,
        expectedCloseDate,
      };

      try {
        await createDeal(dealInput);
        summary.created++;
      } catch (createError) {
        const reason = createError instanceof Error ? createError.message : String(createError);
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: `Could not save this deal: ${reason}` });
        logger.error(
          'CSV deal import: create failed',
          createError instanceof Error ? createError : new Error(String(createError)),
          { file: 'deals/import/route.ts', row: rowNumber }
        );
      }
    }

    logger.info('CSV deal import completed', {
      file: 'deals/import/route.ts',
      total: summary.total,
      created: summary.created,
      skipped: summary.skipped,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      'CSV deal import failed unexpectedly',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'deals/import/route.ts' }
    );
    const message = error instanceof Error ? error.message : 'Deal import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
